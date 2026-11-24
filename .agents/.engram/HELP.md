# Engram Help v0.0.25

## Meta Commands
- engram --version (short: `engram -v`): Show the installed Engram version
- engram inject [--force] [--global-only] [--scope workspace|global|both] [--no-skillset] [--skillset target] [--submodule] [--submodule-remote <git-url>] [--no-global] [--global-path path] [--global-remote <git-url>] [--global-branch main] (short: `engram i`): Initialize or reconcile memory and install compact agent skillset instructions by default
- engram help [topic] (short: `engram h`): Show this help menu or specific topic details & example use-cases
- engram llm: Print the packaged AI agent usage guide from llm.txt
- engram entry (short: `engram e`): Open browser web UI showing runtime configurations and global Git repository status
- engram profile status|list|create|use|merge (short: `engram pf`): Manage isolated global memory profiles for company, personal, or team contexts
- engram update-global-folder <new-path> [--move-from-path path] (short: `engram ugf`): Update the configured global memory folder and optionally move an old global root
- engram completion [bash|zsh|powershell] (short: `engram c`): Generate shell completion support for Tab suggestions
- engram upgrade [--plan] [--latest] [--self] [--memory-only|--global-skillsets-only] [--target agent] (short: `engram up`): Recommend package update and refresh generated help, indexes, graphs, linked agent configs/hooks, global memory, and registered global agent skillsets

## Memory Commands
- engram save rule [--scope workspace|global|both] [--role role] [--task-type task_type] [--show-rule-variants] <text> (short: `engram s`): Draft and save a rule memory after user approval with task-type routing tag
- engram save skill [--scope workspace|global|both] [--role role] [--task-type task_type] [--show-rule-variants] <text> (short: `engram s`): Draft and save a skill memory after user approval with task-type routing tag
- engram save workflow [--scope workspace|global|both] [--role role] [--task-type task_type] [--show-rule-variants] <text> (short: `engram s`): Draft and save a repeatable workflow as a skill memory with task-type routing tag
- engram save knowledge [--scope workspace|global|both] [--role role] [--task-type task_type] [--show-rule-variants] [text] (short: `engram s`): Draft and save a knowledge memory (agent summary or text) with task-type routing tag
- engram save [--scope workspace|global|both] [--role role] [--task-type task_type] [--show-rule-variants] [text] (short: `engram s`): Auto-detect rule, workflow, skill, or knowledge memory from text and add task-type routing tag
- engram save-session [--file transcript.md] [--scope workspace|global|both] [--role role] [--query-level n] [--accept-all] [--show-rule-variants] [session-summary] (short: `engram ss`): Propose multiple memories from one or more recent sessions before approval or explicit accept-all
- engram observe [--file session.md] [--propose] [note] (short: `engram o`): Capture sanitized raw notes in inbox, then optionally propose memories through save-session
- engram take-control [--plan] [--file path] [--dir path] [--include glob] [--exclude glob] [--max-sources n] [--max-chars n] [--all] [--accept-all] [--metacognize] (short: `engram tc`): Explore existing workspace guidance with agent help, token-light accept-all, optional metacognition, and Engram memory writes
- engram metacognize --workspace|--global|--all [--accept-all] [--dry-run] (short: `engram mc`): Let an agent restructure an existing memory folder through save-session-style candidates and approval
- engram load [--all] [--dry-run] [--for-agents] [query] (short: `engram ld`): Route, refine, and load the configured compact memory pack, or preview routed file paths with --dry-run
- engram route [task] (short: `engram rt`): Classify a task into the stable task type used by load and save tags
- engram search [--semantic] <query> (short: `engram f`): Search visible indexed memories with lexical or local semantic scoring
- engram graph [--rebuild] [query] (short: `engram g`): Inspect the derived layered JSON memory graph, dependency layers, and contradiction candidates
- engram verify [workspace|global] (short: `engram vf`): Verify memory file integrity and hashes
- engram rehash [workspace|global] (short: `engram rh`): Recompute and store hashes for all memory files
- engram rebuild-index [workspace|global] (short: `engram ri`): Explicitly rebuild memory indexes from Markdown files
- engram repair [workspace|global] (short: `engram rp`): Report invalid memory files that index rebuild would skip
- engram audit [--author email] [--stale] [--low-confidence] (short: `engram a`): Show audit rows for visible memories with optional filters

## Operations
- engram health (short: `engram he`): Analyze and report visible memory health metrics
- engram quality-check (short: `engram qc`): Evaluate quality score and potential issues for visible memories
- engram stats (short: `engram st`): Show total count and statistics of visible indexed memories
- engram deduplicate (short: `engram dd`): Detect and report similar or duplicate visible memory entries
- engram export [--format agents-md|claude-md|cursorrules] (short: `engram x`): Export visible memory to a specific format or JSON bundle
- engram import [--source agentmemory] [--max n] <bundle.json> (short: `engram im`): Import Engram or agentmemory JSON through the approval gate
- engram archive [--reason text] <memory-id|file> (short: `engram ar`): Move wrong or superseded memory out of active routing after approval
- engram benchmark <cases.json> (short: `engram bm`): Measure graph-aware retrieval hit rate for query/expected-memory cases
- engram ignore status|check <path>|add <pattern> (short: `engram ig`): Manage ignore rules and query file match status
- engram set-role <role...> (short: `engram sr`): Configure active developer roles for context routing and emit immediate reload guidance for Engram-aware hosts
- engram set-save-target workspace|global|both|status: Configure where normal save writes by default
- engram set-load-limit 1..32|status|reset (short: `engram ll`): Configure how many related memories normal load returns before --all is needed
- engram set-proof off|compact|status (short: `engram sp`): Configure whether supported hooks append compact per-response Engram proof lines
- engram set-read startup|auto|always|manual|off|status (short: `engram rd`): Configure hook and manual read behavior for startup, changed prompts, every prompt, manual, or off
- engram set-rule-variant off|light|balanced|strict|status (short: `engram rv`): Tune rule strictness and emit immediate reload guidance: strict helps lower-tier models stay controlled, while top-tier models often work better with light or balanced so strict wording does not limit their reasoning
- engram resolve-conflicts [--dry-run] [--metacognize] [--accept-all] (short: `engram rc`): Preview or resolve Git conflicts in memory files, then optionally run workspace metacognition
- engram install-hooks (short: `engram ih`): Install local Git hooks for Engram integrity checks
- engram agent-hook --host codex|claude|gemini: Internal JSON hook runtime used by installed agent hooks
- engram link [all|list|target] [--global] [--force] [--all-supported] (short: `engram l`): Link Engram skillset, MCP config, slash adapters, and agent hooks to an AI agent
- engram unlink [all|target] [--global] [--force]: Remove Engram skillset, MCP config, instruction content, and agent hooks from an AI agent
- engram clone-memory workspace global [--force] [--dry-run] [--metacognize] [--accept-all] (short: `engram cm`): Clone active memory Markdown between workspace and global scopes; --metacognize uses save-session-style approval instead of raw file copy
- engram sync (short: `engram sy`): Sync global memory with Git remote and refresh enabled live-sync targets
- engram workspace list|info|set|unregister|link|unlink (short: `engram ws`): Manage registered workspaces and their per-workspace configuration
- engram config view|set (short: `engram cfg`): View resolved configuration or set user-level config keys

Run `engram help <topic>` for command examples and use cases.

Every write path requires A/B/C approval before files are changed. Save automatically updates the best matching existing memory, or adds a new memory when no match is found. Fresh installs default normal saves to both workspace and global when global memory is configured; use `engram set-save-target` or `--scope` to choose workspace, global, or both.
