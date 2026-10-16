import machine
import network
import time
import ntptime
import socket  #bibliothèque pour écouter le site web

# ================= Config =================
SSID = 'TON_NOM_WIFI'
PASSWORD = 'TON_MOT_DE_PASSE'

RELAY_PIN = 15
LIGHT_SENSOR_PIN = 26

HEURE_LEVER = 8
HEURE_COUCHER = 20
SEUIL_LUMINOSITE = 30000
OFFSET_HEURES = 2
INTERVALLE_VERIFICATION = 60  # Vérifie les capteurs toutes les 60 secondes
# =================================================

relais = machine.Pin(RELAY_PIN, machine.Pin.OUT)
capteur_lumiere = machine.ADC(LIGHT_SENSOR_PIN)

# Variable pour savoir si on est en auto/ manuel
mode_auto = True


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(SSID, PASSWORD)
    print('Connexion au WiFi en cours...')
    while not wlan.isconnected():
        time.sleep(1)
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


def main():
    global mode_auto
    ip = connect_wifi()
    sync_time()

    # --- Initialisation du Serveur Web pour écouter le site ---
    addr = socket.getaddrinfo('0.0.0.0', 80)[0][-1]
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(addr)
    s.listen(1)
    s.settimeout(0.5)  #bloque la boucle 0.5 sec pour attendre commande
    print(f"Prêt à recevoir des commandes sur http://{ip}")

    derniere_verif_temps = 0

    while True:
        # 1. Écoute des commandes du site
        try:
            client, addr_client = s.accept()
            requete = client.recv(1024).decode('utf-8')

            # Analyse la commande recue
            if 'GET /api/force-on' in requete:
                mode_auto = False
                relais.value(1)  # Force allumage
                print("Action Web: Mode MANUEL -> LUMIÈRE ALLUMÉE")

            elif 'GET /api/force-off' in requete:
                mode_auto = False
                relais.value(0)  # Force extinction
                print("Action Web: Mode MANUEL -> LUMIÈRE ÉTEINTE")

            elif 'GET /api/auto' in requete:
                mode_auto = True
                print("Action Web: Mode AUTO RÉACTIVÉ")
                #Force la vérification pour se recaler
                derniere_verif_temps = 0

                #rép au site web pour lui dire que c'est bon
            reponse = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\n\r\nOK"
            client.send(reponse)
            client.close()

        except OSError:
            pass  # Personne n'a appelé le serveur web

        # 2. Gestion du cycle automatique toutes les 60 secondes
        maintenant = time.time()
        if maintenant - derniere_verif_temps >= INTERVALLE_VERIFICATION:
            derniere_verif_temps = maintenant
            heure, minute = get_heure_locale()
            luminosite = capteur_lumiere.read_u16()

            est_jour = HEURE_LEVER <= heure < HEURE_COUCHER

            # On n'applique le cycle horaire QUE si le mode auto est actif
            if mode_auto:
                if est_jour:
                    relais.value(1)
                else:
                    relais.value(0)

            print(f"[{heure:02d}:{minute:02d}] Auto: {mode_auto} | Relais: {relais.value()} | Lum: {luminosite}")

            # Alertes envoyées dans tous les cas
            if est_jour and luminosite < SEUIL_LUMINOSITE:
                print("ALERTE : Trop sombre en journée !")
            elif not est_jour and luminosite > SEUIL_LUMINOSITE:
                print("ALERTE : Trop lumineux la nuit !")


if __name__ == '__main__':
    main()