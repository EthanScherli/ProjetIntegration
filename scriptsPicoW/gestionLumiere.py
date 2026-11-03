import machine
import network
import time
import ntptime
import socket
import urequests
import ujson
import config

RELAY_PIN = 15
LIGHT_SENSOR_PIN = 26

HEURE_LEVER = 8
HEURE_COUCHER = 20
SEUIL_LUMINOSITE_PCT = 40  # Seuil de tolérance fixé à 40%
OFFSET_HEURES = 2
INTERVALLE_VERIFICATION = 5

relais = machine.Pin(RELAY_PIN, machine.Pin.OUT)
capteur_lumiere = machine.ADC(LIGHT_SENSOR_PIN)

mode_auto = True

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(config.PARTAGE_WIFI_ID, config.PARTAGE_WIFI_PASSWORD)
    print("Connexion au WiFi en cours...")
    while not wlan.isconnected():
        time.sleep(2)
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

def envoyer_donnees_db(lum, alerte_msg, etat_lumiere, mode):
    try:
        payload = {
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

            # LOGIQUE NORMALE POUR LE RELAIS : 1 = Allumé, 0 = Éteint
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
            # FORMULE INVERSÉE POUR LE CAPTEUR RÉEL
            lum_pourcentage = round(((65535 - lum_brute) / 65535) * 100, 1)

            est_jour = HEURE_LEVER <= heure < HEURE_COUCHER

            if mode_auto:
                if est_jour:
                    # On allume (1) seulement s'il fait trop sombre
                    if lum_pourcentage < SEUIL_LUMINOSITE_PCT:
                        relais.value(1)
                    # S'il fait déjà clair, on éteint (0)
                    else:
                        relais.value(0)
                else:
                    # La nuit, on éteint (0)
                    relais.value(0)

            alerte_actuelle = "Aucune"
            
            # Évaluation directe avec le pourcentage de lumière
            if est_jour and lum_pourcentage < SEUIL_LUMINOSITE_PCT:
                alerte_actuelle = "Trop sombre en journee"
            elif not est_jour and lum_pourcentage > SEUIL_LUMINOSITE_PCT:
                alerte_actuelle = "Trop lumineux la nuit"

            print(f"[{heure:02d}:{minute:02d}] Auto: {mode_auto} | Relais: {relais.value()} | Lum: {lum_pourcentage}% | Alerte: {alerte_actuelle}")

            envoyer_donnees_db(lum_pourcentage, alerte_actuelle, relais.value(), mode_auto)

if __name__ == '__main__':
    main()
