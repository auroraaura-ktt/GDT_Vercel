# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Project Structure

The app now has a frontend and backend split:

- `client` layer: the existing React + Vite app in the repository root
- `server` layer: a new Node.js + Express API with JWT auth, role checks, and Neo4j access

### Server stack

- `POST /api/auth/register` hashes passwords with bcrypt and creates users in Neo4j with `role: user`
- `POST /api/auth/login` verifies credentials and returns a JWT containing `id` and `role`
- `GET /api/users/me` requires a valid token
- `GET /api/users` is restricted to `admin` and `moderator`
- `DELETE /api/users/:id` is restricted to `admin`

### Local development

1. Install frontend dependencies in the repo root with `npm install`.
2. Install backend dependencies in `server/` with `npm install`.
3. Copy `server/.env.example` to `server/.env` and set your Neo4j and JWT values. For a local standalone Neo4j instance, keep `NEO4J_URI=bolt://localhost:7687`.
4. Start both apps from the repo root with `npm run dev`.
5. If you want separate processes, use `npm run dev:client` and `npm run dev:server`.

### Promote a user to admin

To bootstrap your first admin account, run this from `server/` after the user exists in Neo4j:

```bash
npm run promote-user -- --email=user@example.com --role=admin
```

You can also promote by user id:

```bash
npm run promote-user -- --id=123 --role=admin
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
