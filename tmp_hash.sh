#!/bin/bash
HASH=$(docker exec servix-n8n node -e "const b=require('bcryptjs');console.log(b.hashSync('ServixN8n@2026',10))")
echo "UPDATE public.\"user\" SET email='sinyuor3sad@gmail.com', password='$HASH', \"firstName\"='Admin', \"lastName\"='Servix' WHERE email IS NULL OR email='';" | docker exec -i servix-postgres psql -U servix -d n8n_db
echo "DONE - Password hash: $HASH"
