import machine
import network
import time
import ntptime
import socket
import urequests
import dht
import config

RELAY_PIN = 15
LIGHT_SENSOR_PIN = 26
DHT_PIN = 12

HEURE_LEVER = 8
HEURE_COUCHER = 20
SEUIL_LUMINOSITE = 30000
OFFSET_HEURES = 2
INTERVALLE_VERIFICATION = 5

relais = machine.Pin(RELAY_PIN, machine.Pin.OUT)
capteur_lumiere = machine.ADC(LIGHT_SENSOR_PIN)
sensor_dht = dht.DHT11(machine.Pin(DHT_PIN, machine.Pin.IN, machine.Pin.PULL_UP))

mode_auto = True

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(config.PARTAGE_WIFI_ID, config.PARTAGE_WIFI_PASSWORD)
    print('Connexion au WiFi en cours...')
    while not wlan.isconnected():
        time.sleep(2)
    ip = wlan.ifconfig()[0]
    print(f"Connecté ! L'IP du Pico W est : {ip}")
    return ip

def sync_time():
    try:
        ntptime.settime()
        print("Heure synchronisée avec succès.")
    except Exception as e:
        print("Erreur de synchronisation NTP:", e)

def get_heure_locale():
    t = time.localtime(time.time() + (OFFSET_HEURES * 3600))
    return t[3], t[4]

def envoyer_donnees_db(temp, hum, lum):
    """Envoie un paquets de toutes les mesures vers Supabase / API"""
    try:
        payload = {
            "temperature": temp,
            "humidite": hum,
            "luminosite": lum,
            "id_Ut": config.ID_UT
        }
        headers = {
            "Content-Type": "application/json",
            "apikey": config.API_KEY,
            "Authorization": f"Bearer {config.API_KEY}"
        }

        res = urequests.post(f"{config.API_URL}/rest/v1/Donnees_Capteurs", json=payload, headers=headers)
        print("Données envoyées à la DB ! Code HTTP :", res.status_code)
        res.close()
    except Exception as e:
        print("Erreur lors de l'envoi DB :", e)

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
    print(f"Prêt à recevoir des commandes sur http://{ip}")

    derniere_verif_temps = 0

    while True:
        try:
            client, addr_client = s.accept()
            requete = client.recv(1024).decode('utf-8')

            if 'GET /api/force-on' in requete:
                mode_auto = False
                relais.value(1)
                print("Action Web: Mode MANUEL -> LUMIÈRE ALLUMÉE")

            elif 'GET /api/force-off' in requete:
                mode_auto = False
                relais.value(0)
                print("Action Web: Mode MANUEL -> LUMIÈRE ÉTEINTE")

            elif 'GET /api/auto' in requete:
                mode_auto = True
                print("Action Web: Mode AUTO RÉACTIVÉ")
                derniere_verif_temps = 0

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

            try:
                sensor_dht.measure()
                temp = sensor_dht.temperature()
                hum = sensor_dht.humidity()
            except Exception as e:
                print("Erreur de lecture du DHT11 :", e)
                temp, hum = None, None

            lum = round(((65535 - lum_brute) / 65535) * 100, 1)

            est_jour = HEURE_LEVER <= heure < HEURE_COUCHER

            if mode_auto:
                if est_jour:
                    relais.value(1)
                else:
                    relais.value(0)

            print(f"[{heure:02d}:{minute:02d}] Auto: {mode_auto} | Relais: {relais.value()} | Temp: {temp}°C | Hum: {hum}% | Lum: {lum}%")

            envoyer_donnees_db(temp, hum, lum)

            if est_jour and lum_brute < SEUIL_LUMINOSITE:
                print("ALERTE : Trop sombre en journée !")
            elif not est_jour and lum_brute > SEUIL_LUMINOSITE:
                print("ALERTE : Trop lumineux la nuit !")

if __name__ == '__main__':
    main()
