type ComposerProps = {
  value: string;
  isSending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

const suggestedPrompts = [
  "List installed skills",
  "Describe runtime mode",
  "Explain the deep-agent flag",
];

export function Composer({ value, isSending, onChange, onSubmit }: ComposerProps) {
  return (
    <section className="composer panel">
      <h3>Composer</h3>
      <form
        className="composer-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="composer-label" htmlFor="agent-prompt">
          Send a prompt to the runtime adapter
        </label>
        <textarea
          id="agent-prompt"
          name="prompt"
          className="composer-input"
          placeholder="Ask about tools, runtime mode, or how the stream behaves."
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={isSending}
        />
        <div className="composer-toolbar">
          <div className="composer-actions" aria-label="Suggested prompts">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="composer-chip"
                onClick={() => onChange(prompt)}
                disabled={isSending}
              >
                {prompt}
              </button>
            ))}
          </div>
          <button type="submit" className="composer-submit" disabled={isSending}>
            {isSending ? "Sending..." : "Send prompt"}
          </button>
        </div>
      </form>
      <p className="composer-hint">
        Single approved function: <code>get_installed_skills</code>
      </p>
    </section>
  );
}
