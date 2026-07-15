# Jarvis — Your Private Second Brain

Jarvis is a private, single-tenant **second brain and marketing operator** built on
Next.js and Vercel Blob. You upload your own knowledge (notes, brand docs, an
Obsidian vault), and Jarvis answers *only* from that material — then turns it into
on-brand content in your own voice.

Everything lives on one screen at `/jarvis`: a chat, a live view of the AI org
running your request, a graph of your uploaded brain, and a full Brand Studio.

---

## Deploy in one click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdanialhussin71%2FSecond-Brain-Workshop&env=OPENAI_API_KEY&envDescription=OpenAI%20API%20key%20that%20powers%20Jarvis%20chat%20and%20carousel%20image%20generation.&envLink=https%3A%2F%2Fplatform.openai.com%2Fapi-keys&project-name=second-brain-workshop&repository-name=second-brain-workshop&stores=%5B%7B%22type%22%3A%22blob%22%7D%5D)

The button does everything for you:

1. **Clones the repo** into your own GitHub account.
2. **Provisions a private Vercel Blob store** and connects it to the project —
   this is where your brain, brand kit, and uploaded assets are stored durably.
   Vercel injects the `BLOB_READ_WRITE_TOKEN` automatically; you never set it by hand.
3. **Asks for one environment variable — `OPENAI_API_KEY`.** That is the only
   secret you need to supply for a working deployment.

When the build finishes, open the deployment, go to `/jarvis`, and upload your
first documents.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | **Yes** | Powers Jarvis chat, the marketing agents, and carousel image generation. |
| `BLOB_READ_WRITE_TOKEN` | Auto | Injected by Vercel when the Blob store is connected. Do not set it manually. |
| `OPENAI_MODEL` | Optional | Override the chat/reasoning model. Defaults to `gpt-5.6-sol` (medium reasoning). |
| `OPENAI_IMAGE_MODEL` | Optional | Override the image model. Defaults to `gpt-image-2`. |

For the standard deployment, **`OPENAI_API_KEY` is all you add.** Everything else
is provisioned or has a sensible default.

---

## What Jarvis does

### 1. A private second brain

Open `/jarvis`, upload `.md`, `.txt`, or a `.zip` containing markdown (an exported
Obsidian vault works well). Each upload **replaces** your previous brain and is
merged into a single private Blob object (`owner/BRAIN.md`).

Jarvis answers grounded strictly in that material. If your notes don't support an
answer, it says so and tells you which document would fill the gap — no
hallucinated facts about your business.

### 2. A visual brain graph

Uploaded notes and their `[[wiki-links]]` are parsed into a force-directed graph
so you can see how your knowledge connects, with node size scaled by how well
each note is linked.

### 3. A marketing OS that writes in your voice

Behind the chat is a small AI org chart. You only ever talk to the **CEO**, which
reads every document and routes your instruction to the **CMO**, who fires the
right specialists:

- **Research** — a shared specialist that reads market angles and trends up front.
- **Content** — writes in your voice and picks the right **format**:
  - **Text** posts
  - **Picture** (single-image) posts
  - **Carousel** swipe-through decks
  - **Reels** short-form scripts
  - **Long-form** video scripts
  - **Newsletter** emails

The live run streams into the UI so you can watch each agent contribute.

### 4. Brand Studio (Settings → Brand Kit)

A complete, Blob-backed identity system. Upload a founder portrait, a logo, and
up to four visual references; define an exact colour palette, typography, voice
DNA, language guardrails, and a locked visual style. You can also ask the model to
**reverse-engineer your visual system** from the references you uploaded.

The kit is fed into every marketing run so output stays on-brand. For carousels,
your face, logo, and style references are sent to the image model's edit endpoint
so the finished artwork actually reflects your assets — carousel image quality
(Low / Medium / High) is a setting.

---

## Local development

Local runs still need Blob credentials, because the brain and brand kit are stored
on Blob.

```bash
npm install

# After connecting a Blob store to a Vercel project, pull its token locally:
vercel env pull .env.local

# Add your OpenAI key to .env.local:
#   OPENAI_API_KEY=sk-...

npm run dev
```

Then open http://localhost:3000 — the root redirects to `/jarvis`.

Other scripts:

```bash
npm run build      # production build
npm start          # run the production build
npm run typecheck  # tsc --noEmit
```

See [`.env.example`](./.env.example) for the full list of variables.

---

## Stack

- **Next.js 15** (App Router, React 19) on the Vercel runtime
- **Vercel Blob** for durable, private storage of the brain, brand kit, and assets
- **OpenAI Responses API** (`gpt-5.6-sol`) for reasoning and content
- **GPT Image 2** (`gpt-image-2`) for on-brand carousel artwork
- **d3-force** for the brain graph, **Tailwind CSS** + **Motion** for the UI
