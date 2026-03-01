import json
from pathlib import Path

#import data to be written and check for dupes
folder_to_write = Path("C:/OP DeckBuilder/src/data")
write_to_file = "cards.json"
file_to_open_and_write = folder_to_write / write_to_file

if file_to_open_and_write.exists() and file_to_open_and_write.stat().st_size > 0:
    with open(file_to_open_and_write, "r", encoding="utf-8") as readfile:
        masterList = json.load(readfile)
else:
    masterList = []



#Gathering Data
datafolder = Path("C:/OP DeckBuilder/raw_data")
file_name = "st28.json"
file_to_open = datafolder / file_name

with open(file_to_open, "r", encoding="utf-8") as readfile:
    card_list = json.load(readfile)

card = card_list[0]




#main function to loop through current json and write to mastercardlist normalize
i = 0
for card in card_list:
    copiedCard = {
        "id": card["id"],
        "name": card["name"],
        "cost": int(card["cost"]) if card["cost"] and card["cost"] != "-" else 0,
        "type": card["type"].lower(),
        "rarity": card["rarity"].lower(),
        "color": card["color"].lower(),
        "trigger": True if card["trigger"] != ""  else False,
        "images": card["images"],
        "attribute": card["attribute"].get("name", ""),
        "power": int(card["power"]) if card.get("power") and card["power"] != "-" else 0,
        "counter": int(card["counter"]) if card.get("counter") and card["counter"] != "-" else 0,
        "family": card.get("family", ""),
        }
    
    exist = False
    for masterCard in masterList:
        if masterCard["id"] == copiedCard["id"]:
            exist = True
            print("dupe found, skipped")
            break
    if not exist:
        print("added card: ", i)
        i+=1
        masterList.append(copiedCard)


#write to json file
with open(file_to_open_and_write, "w", encoding="utf-8") as writefile:
    json.dump(masterList, writefile, indent=4)