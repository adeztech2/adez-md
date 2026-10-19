#!/bin/bash
set -e
APP=adez-md

heroku create $APP || true
heroku stack:set container -a $APP

heroku config:set \
  BOT_NAME="ADEZ MD" \
  OWNER_NUMBER=254111783552 \
  SUPABASE_URL="your-supabase-url" \
  SUPABASE_KEY="your-supabase-key" \
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
