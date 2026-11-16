import machine
import network
import time
import ntptime
import socket
import urequests
import ujson
import dht
import config

RELAY_PIN = 15
RELAIS_CHAUFFAGE_PIN = 14
LIGHT_SENSOR_PIN = 26
DHT_PIN = 11

HEURE_LEVER = 8
HEURE_COUCHER = 20
SEUIL_LUMINOSITE_PCT = 40
OFFSET_HEURES = 2
INTERVALLE_VERIFICATION = 5

CHAUFFAGE_ACTIF = True
CHAUFFAGE_ON = 1
CHAUFFAGE_OFF = 0
TEMP_IDEALE = 31.5
TEMP_MIN = 27.0
TEMP_MAX = 36.0

relais = machine.Pin(RELAY_PIN, machine.Pin.OUT)
relais_chauffage = machine.Pin(RELAIS_CHAUFFAGE_PIN, machine.Pin.OUT)
relais_chauffage.value(CHAUFFAGE_OFF)
capteur_lumiere = machine.ADC(LIGHT_SENSOR_PIN)
capteur_dht = dht.DHT11(machine.Pin(DHT_PIN))

mode_auto = True


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(False)
    time.sleep(1)
    wlan.active(True)

    print("Réseaux visibles :")
    try:
        for r in wlan.scan():
            print("  -", r[0].decode(), "| signal:", r[3])
    except Exception as e:
        print("Scan impossible :", e)

    print("Connexion à :", config.PARTAGE_WIFI_ID)
    while not wlan.isconnected():
        wlan.disconnect()
        wlan.connect(config.PARTAGE_WIFI_ID, config.PARTAGE_WIFI_PASSWORD)
        for _ in range(15):
            statut = wlan.status()
            if wlan.isconnected():
                break
            if statut == network.STAT_WRONG_PASSWORD:
                print("Mot de passe refusé par le partage.")
                break
            if statut == network.STAT_NO_AP_FOUND:
                print("Réseau introuvable (nom incorrect, hors de portée ou en 5 GHz).")
                break
            time.sleep(1)
        if not wlan.isconnected():
            print("Échec (statut {}), nouvelle tentative...".format(wlan.status()))
            time.sleep(3)

    ip = wlan.ifconfig()[0]
    print(f"Connecté ! L'IP du Pico W est : {ip}")
    return ip


def sync_time():
    try:
        ntptime.host = "1.be.pool.ntp.org"
        ntptime.settime()
        print("Heure synchronisée avec succès.")
    except Exception as e:
        print("NTP bloqué. Forçage de la date...")
        machine.RTC().datetime((2026, 11, 2, 0, 12, 0, 0, 0))


def get_heure_locale():
    t = time.localtime(time.time() + (OFFSET_HEURES * 3600))
    return t[3], t[4]


def lire_dht():
    try:
        capteur_dht.measure()
        return capteur_dht.temperature(), capteur_dht.humidity()
    except OSError:
        print("Erreur de lecture DHT11 (timeout). Vérifier le branchement de DATA.")
        return None, None


def envoyer_donnees_db(temp, hum, lum, alerte_msg, etat_lumiere, mode):
    try:
        payload = {
            "temperature": temp,
            "humidite": hum,
            "luminosite": lum,
            "etat_relais": etat_lumiere,
            "mode_auto": mode,
            "alerte": alerte_msg,
            "id_Ut": config.ID_UT
        }
        headers = {
            "Content-Type": "application/json",
            "apikey": config.API_KEY,
            "Authorization": f"Bearer {config.API_KEY}"
        }

        donnees_encodees = ujson.dumps(payload).encode('utf-8')

        res = urequests.post(f"{config.API_URL}/rest/v1/Donnees_Capteurs", data=donnees_encodees, headers=headers)
        print("Données envoyées à Supabase. Statut HTTP :", res.status_code)
        res.close()
    except Exception as e:
        print("Erreur d'envoi à la DB :", e)


def main():
    global mode_auto
    ip = connect_wifi()
    sync_time()

    addr = socket.getaddrinfo('0.0.0.0', 80)[0][-1]
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(addr)
    s.listen(1)
    s.settimeout(0.5)
    print(f"Serveur prêt à recevoir des commandes sur http://{ip}")

    derniere_verif_temps = 0

    while True:
        try:
            client, addr_client = s.accept()
            requete = client.recv(1024).decode('utf-8')

            if 'GET /api/force-on' in requete:
                mode_auto = False
                relais.value(1)
                print(">>> Action Web : Mode MANUEL -> LUMIÈRE ALLUMÉE")
            elif 'GET /api/force-off' in requete:
                mode_auto = False
                relais.value(0)
                print(">>> Action Web : Mode MANUEL -> LUMIÈRE ÉTEINTE")
            elif 'GET /api/auto' in requete:
                mode_auto = True
                derniere_verif_temps = 0
                print(">>> Action Web : Mode AUTO RÉACTIVÉ")

            reponse = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\n\r\nOK"
            client.send(reponse)
            client.close()
        except OSError:
            pass

        maintenant = time.time()
        if maintenant - derniere_verif_temps >= INTERVALLE_VERIFICATION:
            derniere_verif_temps = maintenant
            heure, minute = get_heure_locale()

            lum_brute = capteur_lumiere.read_u16()
            lum_pourcentage = round(((65535 - lum_brute) / 65535) * 100, 1)
            est_jour = HEURE_LEVER <= heure < HEURE_COUCHER

            temp, hum = lire_dht()

            if mode_auto:
                if est_jour:
                    if lum_pourcentage < SEUIL_LUMINOSITE_PCT:
                        relais.value(1)
                    else:
                        relais.value(0)
                else:
                    relais.value(0)

            alerte_actuelle = "Aucune"
            etat_chauffage = 0

            if temp is not None:
                if CHAUFFAGE_ACTIF:
                    if temp < TEMP_IDEALE:
                        relais_chauffage.value(CHAUFFAGE_ON)
                        etat_chauffage = 1
                    else:
                        relais_chauffage.value(CHAUFFAGE_OFF)

                if temp < TEMP_MIN:
                    alerte_actuelle = "Alerte FROID"
                elif temp > TEMP_MAX:
                    alerte_actuelle = "Alerte CHAUD"
            else:
                relais_chauffage.value(CHAUFFAGE_OFF)

            if alerte_actuelle == "Aucune":
                if est_jour and lum_pourcentage < SEUIL_LUMINOSITE_PCT:
                    alerte_actuelle = "Trop sombre en journee"
                elif not est_jour and lum_pourcentage > SEUIL_LUMINOSITE_PCT:
                    alerte_actuelle = "Trop lumineux la nuit"

            print(f"[{heure:02d}:{minute:02d}] Auto: {mode_auto} | Relais: {relais.value()} | Lum: {lum_pourcentage}% | "
                  f"Temp: {temp}°C | Hum: {hum}% | Chauffage: {'ON' if etat_chauffage else 'OFF'} | Alerte: {alerte_actuelle}")

            envoyer_donnees_db(temp, hum, lum_pourcentage, alerte_actuelle, relais.value(), mode_auto)


if __name__ == '__main__':
    main()
