# RoleMap

RoleMap is an AI career-transition planner for professionals with 1–6 years of experience.

A visitor pastes a genuine target job description and supplies three background signals. The app returns exactly three requirement-linked **evidence gaps** and one 7-day proof action for each.

## Stack
- Vercel static frontend + Node serverless function
- Google Gemini via `@google/genai`
- Supabase for scan storage, rate limiting and weekly gap read-back

## Required Vercel environment variables
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

No secret values are committed to this repository.

## Database
The live Supabase project is already provisioned. The application writes only from the serverless function. The `analyses` table has RLS enabled and browser roles do not receive table privileges.

## Guardrails
RoleMap does not predict hiring, infer protected traits, judge intelligence or convert missing evidence into a claim that a user lacks a skill.
