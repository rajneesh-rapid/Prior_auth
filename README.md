# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/4e8e8d06-d36f-4168-87ba-baec72bf74da

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/4e8e8d06-d36f-4168-87ba-baec72bf74da) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (for data persistence)

## Supabase Setup

This project uses Supabase for persistent data storage. Follow these steps to set it up:

### 1. Create a Supabase Project

1. Go to [Supabase](https://app.supabase.com) and sign in
2. Create a new project
3. Wait for the project to be fully provisioned

### 2. Get Your API Keys

1. In your Supabase project, go to **Settings** > **API**
2. Copy your **Project URL** and **anon/public key**

### 3. Set Up Environment Variables

1. Create a `.env` file in the root directory (copy from `.env.example` if it exists)
2. Add the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace `your_supabase_project_url` and `your_supabase_anon_key` with the values from step 2.

### 4. Run Database Migration

1. In your Supabase project, go to **SQL Editor**
2. Open the file `supabase/migrations/001_initial_schema.sql`
3. Copy the entire SQL content
4. Paste it into the SQL Editor in Supabase
5. Click **Run** to execute the migration

This will create the necessary tables:
- `claims` - Main claims table
- `claim_items` - Individual claim items
- `claim_documents` - Claim documents
- `chart_configurations` - Chart configuration storage

### 5. Verify Setup

1. Start the development server: `npm run dev`
2. The app will automatically migrate any existing localStorage data to Supabase on first load
3. Check the Supabase dashboard to verify data is being stored

**Note:** If Supabase is not configured, the app will fall back to localStorage with a warning message.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/4e8e8d06-d36f-4168-87ba-baec72bf74da) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
