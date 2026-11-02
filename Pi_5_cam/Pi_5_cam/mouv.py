#Ce srcipt a pour but de voir ou le serpent se trouve
#Detail : enft ce script reagit juste a motion, motion permet d'executer
#ce script quand le serpent bouge donc on envoie dans une db ce moment
#(Motion permet aussi de mettre un carre autout de l objet en mouv)

import sys
import requests

chemin = sys.argv[1]
site = "on a pas encore de site"

donnees = {'id' : '1'} #ce serait plus style de mettre un id pas en dur
fichier = {'photo': open(chemin, 'rb')}

try:
	reponse = requests.post(site, data=donnees, files=fichiers)
except Exception as e:
	print("erreur ", e)
