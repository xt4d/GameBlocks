![GameBlocks preview](assets/logo.jpg)

## 📖 Introduction

### What Is GameBlocks

GameBlocks helps coding agents build browser-based 3D game prototypes.

GameBlocks provides **building-block code**: concise and self-explanatory modules designed for agents to compose, adapt, and generalize from while implementing fragile 3D game systems such as coordinate frames, actor motion, and world structure.

### Why Use GameBlocks

Natural language is a weak interface for precise 3D behavior. Prompts and agent reasoning must compress spatial transformations into language tokens. Small ambiguities can cause inverted directions, unstable motion, or gameplay state that no longer matches what appears on screen.

GameBlocks reduces that difficulty by turning fragile 3D and gameplay patterns into inspectable implementations with clear semantics. Instead of deriving 3D behavior from scratch, agents can generalize from GameBlocks to build spatially accurate 3D games.

### For Stateful Generative Worlds

GameBlocks focuses on the stateful layer of a world rather than visual aesthetics. The vision is that [world-rendering models](https://www.worldlabs.ai/blog/taxonomy-of-world-models) will increasingly lift the burden of visual generation.

In that future, GameBlocks provides the structured interactive state that those models can render from, update, and keep consistent as agents and players act inside the world.

References: [Moonlake](https://moonlakeai.com/blog/why-world-models-need-structure-not-just-scale), [Game Cartridges](https://x.com/AlbyHojel/status/2057193508822536459), [Project Eden](https://www.tripo3d.ai/research/project-eden).


## 🤖 Use in Agents

GameBlocks can be used as a local skill so a coding agent can discover it when a task involves browser-based 3D game development.

### Codex

1. Clone the repository locally.

2. Run this command from the repository root (to copy `gameblocks` to the skills folder):
```bash
mkdir -p ~/.codex/skills/gameblocks && cp -R gameblocks/. ~/.codex/skills/gameblocks/
```
3. Restart the Codex app (optional).

4. In the Codex chatbox, invoke the skill by typing `/gameblocks` or `$gameblocks`, or let it load automatically when the task matches the skill description.

### Claude Code

1. Clone the repository locally.

2. Run this command from the repository root (to copy `gameblocks` to the skills folder):
```bash
mkdir -p ~/.claude/skills/gameblocks && cp -R gameblocks/. ~/.claude/skills/gameblocks/
```
3. Restart the Claude app (optional).

4. In the Claude Code chatbox, invoke the skill by typing `/gameblocks`, or let it load automatically when the task matches the skill description.

## 🎬 Video Demo

https://github.com/user-attachments/assets/98d22d80-06b6-49ac-8b33-2215ccb42222