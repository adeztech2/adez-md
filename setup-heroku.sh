#!/bin/bash
set -e
APP=adez-md

heroku create $APP || true
heroku stack:set container -a $APP

heroku config:set \
  BOT_NAME="ADEZ MD" \
  OWNER_NUMBER=254111783552 \
  SUPABASE_URL="https://nonmdcadnadbyqmwrvlu.supabase.co" \
  SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbm1kY2FkbmFkYnlxbXdydmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDM3MDYsImV4cCI6MjEwNzQxOTcwNn0.poRnRS3b3BpfmBSMcCJEPO-CGQXMA0oFE6bVkKhnquM" \
  MAX_SESSIONS=5 \
  STAGGER_MS=4000 \
  START_DELAY_MS=0 \
  BOT_FONT=bold \
  AI_API_URL="https://api.deepseek.com/v1/chat/completions" \
  AI_MODEL=deepseek-chat \
  AI_API_KEY="your-ai-key" \
  -a $APP

git add .
git commit -m "Heroku setup" || true
git push heroku main
heroku logs --tail -a $APP
