#!/bin/bash

HOST=192.168.178.49

echo $(date) > last-backup.txt

# Backup on NAS
# rsync -avzh last-backup.txt michele@$HOST:Projects/Nuoto/last-backup.txt
rsync -avzh data_federnuoto/ michele@$HOST:Projects/Nuoto/data_federnuoto
rsync -avzh data_federnuoto_master/ michele@$HOST:Projects/Nuoto/data_federnuoto_master
rsync -avzh data_federnuoto_records/ michele@$HOST:Projects/Nuoto/data_federnuoto_records
rsync -avzh data_ficr/ michele@$HOST:Projects/Nuoto/data_ficr
