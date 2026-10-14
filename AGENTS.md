## Output and Tool-Calling Rules

- Use native OpenCode tools to execute actions. Never simulate tool execution by printing tool names, arguments, or payloads in assistant messages.
- Never expose raw JSON, YAML, XML, or internal tool-call payloads as progress updates unless the user explicitly requests them.
- Use the native todo/task management tool when available to create, update, and track tasks.
- If a native tool call is unavailable or unsupported, explain the limitation in plain language. Do not imitate the tool call by generating its JSON representation.
- Present plans as concise Markdown checklists with clear task descriptions and statuses.
- Present progress updates in natural language, describing what has been completed, what is in progress, and what remains.
- After approval of a plan, execute the approved tasks using the available tools. Do not merely print a structured representation of the plan.
- Keep tool arguments separate from user-facing explanations.
- Do not claim that a tool was executed unless the tool actually ran successfully.
- At completion, summarize the changes, files affected, and tests performed in Markdown.
