FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -s /bin/bash agent

# Install pi coding agent (run as root before USER agent)
RUN npm install -g @mariozechner/pi-coding-agent

# Keep Playwright browsers in a shared location so Sandcastle's runtime UID
# can execute them even though the image is built as root.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Run as root so Chromium sandbox is automatically disabled — Playwright's recommendation
# for trusted E2E tests in Docker. No --no-sandbox flag needed.
RUN npx -y playwright@1.59.1 install --with-deps chromium

# Sandcastle runs the container as the host UID:GID, not as the image's root
# user, so make the home and browser cache writable/executable for that UID.
RUN mkdir -p /home/agent /ms-playwright \
  && chmod -R 0777 /home/agent /ms-playwright

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and starts the container with its own command (sleep infinity). Keep this as CMD
# so the provider can override it cleanly without duplicating arguments.
CMD ["sleep", "infinity"]