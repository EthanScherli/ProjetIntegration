#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv("/home/ephec-ti/.env")
# --- CONFIGURATION ---
SUPABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_KEY = os.getenv("SERVICE_ROLE")

BUCKET_NAME = "clips" #nom du bucket
USER_ID = 14      # ID de l'utilisateur
CAM_ID = 1       # ID de la caméra
MAX_CLIPS = 10   # Limite de clips à conserver

def main():
    if len(sys.argv) < 2:
        print("Erreur : Aucun fichier spécifié.")
        sys.exit(1)

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"Erreur : Fichier introuvable ({filepath})")
        sys.exit(1)

    filename = os.path.basename(filepath)
    storage_path = f"user_{USER_ID}/{filename}"

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Envoi du fichier vidéo dans Supabase Storage
    with open(filepath, "rb") as f:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=f,
            file_options={"content-type": "video/mp4"}
        )

    # 2. Insertion de l'entrée dans la table Historique
    supabase.table("Historique").insert({
        "date_creation": datetime.now(timezone.utc).isoformat(),
        "id_cam": CAM_ID,
        "nom_fichier": filename,
        "chemin_fichier": storage_path,
        "id_Ut": USER_ID
    }).execute()

    # 3. Vérification du nombre de clips pour cet utilisateur (Rotation FIFO)
    response = supabase.table("Historique") \
        .select("id, chemin_fichier") \
        .eq("id_Ut", USER_ID) \
        .order("date_creation", desc=False) \
        .order("id", desc=False) \
        .execute()

    records = response.data

    # Si on dépasse 10 clips, on supprime les plus anciens
    if len(records) > MAX_CLIPS:
        clips_a_supprimer = records[:len(records) - MAX_CLIPS]
        
        for clip in clips_a_supprimer:
            # Suppression du fichier vidéo dans le Storage
            supabase.storage.from_(BUCKET_NAME).remove([clip["chemin_fichier"]])
            # Suppression de la ligne dans la table Historique
            supabase.table("Historique").delete().eq("id", clip["id"]).execute()

    # 4. Suppression du fichier local sur la carte SD du Raspberry Pi
    os.remove(filepath)

if __name__ == "__main__":
    main()
