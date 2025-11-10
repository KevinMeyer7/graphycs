#!/bin/bash
# Unset any shell-level OPENAI_API_KEY to ensure .env.local is used
unset OPENAI_API_KEY
unset ELEVENLABS_API_KEY

# Start Next.js dev server directly
npx next dev
