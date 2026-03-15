# @arrivd/typescript-config

Shared TypeScript configs for all arrivd workspaces.

```json
{
  "extends": "@arrivd/typescript-config/base.node.json"
}
```

## Configs

| File | Use case |
|------|----------|
| `base.json` | Strict base — all workspaces |
| `base.app.json` | React/browser apps (DOM libs, JSX) |
| `base.node.json` | Node.js/server packages |
| `library.json` | Publishable libraries |

All configs: `strict`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`, bundler resolution.
