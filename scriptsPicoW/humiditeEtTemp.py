import machine
import network
import time
import urequests
import ujson
import dht
import config
DHT_PIN = 11
RELAIS_CHAUFFAGE_PIN = 15
CHAUFFAGE_ACTIF = True
CHAUFFAGE_ON = 1
CHAUFFAGE_OFF = 0
INTERVALLE_VERIFICATION = 5
TEMP_IDEALE = 31.5
TEMP_MIN = 27.0
TEMP_MAX = 36.0

capteur = dht.DHT11(machine.Pin(DHT_PIN))

relais_chauffage = machine.Pin(RELAIS_CHAUFFAGE_PIN, machine.Pin.OUT)
relais_chauffage.value(CHAUFFAGE_OFF)

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

    print("Connecté ! IP :", wlan.ifconfig()[0])

def lire_dht():
    try:
        capteur.measure()
        return capteur.temperature(), capteur.humidity()
    except OSError:
        print("Erreur de lecture DHT11 (timeout). Vérifier le branchement de DATA.")
        return None, None

def envoyer_donnees_db(temp, hum, alerte_msg, etat_chauffage):
    try:
        payload = {
            "temperature": temp,
            "humidite": hum,
            "etat_relais": etat_chauffage,
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
    connect_wifi()

    while True:
        time.sleep(INTERVALLE_VERIFICATION)

        temp, hum = lire_dht()

        alerte = "Aucune"
        etat_chauffage = 0

        if temp is not None:
            if CHAUFFAGE_ACTIF:
                if temp < TEMP_IDEALE:
                    relais_chauffage.value(CHAUFFAGE_ON)
                    etat_chauffage = 1
                else:
                    relais_chauffage.value(CHAUFFAGE_OFF)

            if temp < TEMP_MIN:
                alerte = "Alerte FROID"
            elif temp > TEMP_MAX:
                alerte = "Alerte CHAUD"
        else:
            relais_chauffage.value(CHAUFFAGE_OFF)
            alerte = "Erreur capteur"

        print("Température : {} °C | Humidité : {} % | Chauffage : {} | Alerte : {}".format(
            temp, hum, "ON" if etat_chauffage else "OFF", alerte))

        envoyer_donnees_db(temp, hum, alerte, etat_chauffage)

if __name__ == '__main__':
    main()