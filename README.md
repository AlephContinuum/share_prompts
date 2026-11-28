# PromptLab

Share AI prompts, improve them with AI, and test them on several models side by side.
A judge model compares the answers, picks the best one and writes a combined answer.

**Stack:** Next.js 15 (App Router) · React 19 · MongoDB Atlas + Mongoose · NextAuth (Google) ·
Amazon Bedrock (Converse API) · Tailwind CSS · deployable on AWS Amplify

## Features

- **Prompt Playground**: run one prompt on up to 4 models in parallel, across different providers, with
  response time and token counts.
- **Model council / judge**: a second-layer model compares the answers, explains the winner and writes a
  combined best answer (a "mixture of agents" pattern). Answers are shown to the judge anonymously
  (A, B, C...) so it can't favour a model it recognises, including itself.
- **Improve with AI**: rewrites a draft prompt with a role, output format and constraints, and suggests tags.
- **Community feed**: create, edit and delete prompts, like them, sort by newest or most liked, and search.
- **Multi-provider AI layer** (`lib/llm.js`): Amazon Bedrock, Groq, Google Gemini, NVIDIA, OpenAI and DeepSeek behind one
  `generate()` call. Every provider with credentials is enabled at once; with none, a mock mode runs
  with no API key.

## Architecture

```
Browser (React client components)
   │  fetch /api/*  (no API keys in the browser)
   ▼
Next.js route handlers (server)
   ├── /api/prompt/*         CRUD + likes      ──► MongoDB Atlas (Mongoose)
   ├── /api/ai/run           parallel models + judge ─┐
   ├── /api/ai/suggest       improve + tag           ├─► lib/llm.js ──► Bedrock / Groq / Gemini / NVIDIA / OpenAI / DeepSeek
   └── /api/auth/*           NextAuth (Google)       ┘
```

### Security choices

- Every write endpoint checks the **server-side session** (`getServerSession`). The creator of a prompt comes
  from the session, never from the request body, and only the owner can edit or delete a prompt.
- AI endpoints need sign-in, are **rate-limited per user**, cap prompt length, and only accept models from
  a server-side allow-list, so a client can't pick an expensive model.
- Public API responses include only `username` and `image` for creators, not email addresses.
- On AWS, Bedrock credentials come from an **IAM role**; access keys are only a local-development fallback.

## Running locally

```bash
npm install
cp .env.example .env      # fill in MongoDB + Google OAuth; AI keys are optional
npm run dev               # http://localhost:3000
```

Without any AI key the app runs in **mock mode** with fake answers, so the UI can be tried end to end.
For real answers, set any of `GROQ_API_KEY` or `GEMINI_API_KEY` (free tiers), `NVIDIA_API_KEY`,
`OPENAI_API_KEY`, `DEEPSEEK_API_KEY` or the
`BEDROCK_*` variables. See `.env.example` for model lists and the optional `JUDGE_MODEL` / `UTILITY_MODEL`.

## Deploying on AWS Amplify

1. Push the repo to GitHub, then in the Amplify console choose **Create new app → GitHub** and pick this repo.
   Amplify detects Next.js and uses `amplify.yml`.
2. Add environment variables: `MONGODB_URI`, `GOOGLE_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL` (your Amplify URL), `BEDROCK_ENABLED=true`, `BEDROCK_REGION`, `BEDROCK_MODELS`, plus any
   other provider keys you use. Amplify reserves `AWS_*` names, which is why the app reads `BEDROCK_*`.
3. Give the app an **IAM compute role** with `bedrock:InvokeModel` on the models you use
   (App settings → IAM roles → Compute role).
4. In the Bedrock console, enable access to the models listed in `BEDROCK_MODELS`.
5. In MongoDB Atlas → Network Access, allow the Amplify servers to connect.
6. In Google Cloud Console, add `https://<your-amplify-domain>/api/auth/callback/google` as an
   authorized redirect URI.

## Project structure

```
app/
  api/ai/          models, run (multi-model + judge), suggest
  api/prompt/      list, create, read/update/delete, like
  playground/      Prompt Playground page
components/        feed, form, promptCard, playground, nav, profile
lib/llm.js         provider-agnostic LLM layer
lib/rateLimit.js   per-user rate limiting
utils/auth.js      NextAuth config + session helpers
models/            Mongoose schemas (User, Prompt)
```
