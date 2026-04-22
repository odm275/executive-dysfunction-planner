# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## Sandcastle With Podman (macOS)

This repo uses Sandcastle with the Podman sandbox provider.

1. Install Podman.
2. Initialize the VM once:

```bash
podman machine init
```

3. Start Podman Machine:

```bash
podman machine start
```

4. Verify runtime health:

```bash
podman --version
podman machine list
podman info
```

5. Build and run Sandcastle:

```bash
npm run sandcastle:build
npm run sandcastle
```

Notes:
- Sandcastle's Podman provider calls the `podman` binary directly and does not auto-start Podman Machine on macOS.
- The auth mount path `~/.pi/agent/auth.json` must exist on your host.
- Cleanup and reset scripts are Podman-based:

```bash
npm run sandcastle:clean
npm run sandcastle:reset
```
