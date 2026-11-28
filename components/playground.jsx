"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

const MAX_MODELS = 4;

const Stat = ({ children }) => (
  <span className='rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600'>{children}</span>
);

const Playground = () => {
  const { data: session, status } = useSession();
  const promptId = useSearchParams().get("id");

  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState(null);
  const [selected, setSelected] = useState([]);
  const [judge, setJudge] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState(null);

  // Which provider/models the server has configured
  useEffect(() => {
    fetch("/api/ai/models")
      .then((r) => r.json())
      .then((data) => {
        setProvider(data);
        setSelected(data.models.slice(0, 3));
      })
      .catch(() => setError("Could not load models"));
  }, []);

  // Opened from a prompt card: load that prompt
  useEffect(() => {
    if (!promptId) return;
    fetch(`/api/prompt/${promptId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPrompt(data.prompt));
  }, [promptId]);

  const toggleModel = (model) =>
    setSelected((prev) =>
      prev.includes(model)
        ? prev.filter((m) => m !== model)
        : prev.length < MAX_MODELS
        ? [...prev, model]
        : prev
    );

  const run = async (e) => {
    e.preventDefault();
    setRunning(true);
    setError("");
    setOutput(null);
    try {
      const res = await fetch("/api/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, models: selected, judge, promptId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setOutput(await res.json());
    } catch (err) {
      setError(err.message || "Run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className='w-full flex-start flex-col'>
      <h1 className='head_text text-left'>
        <span className='blue_gradient'>Prompt Playground</span>
      </h1>
      <p className='desc text-left max-w-2xl'>
        Run one prompt on several models side by side. A judge model then compares the answers,
        picks the best one and writes a combined answer.
      </p>

      {provider && (
        <p className='mt-3 text-sm text-gray-500'>
          Provider: <span className='font-semibold text-gray-700'>{provider.label}</span>
        </p>
      )}

      <form onSubmit={run} className='mt-8 w-full flex flex-col gap-5 glassmorphism'>
        <label>
          <span className='font-satoshi font-semibold text-base text-gray-700'>Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='Write or paste a prompt to test'
            maxLength={4000}
            required
            className='form_textarea'
          />
        </label>

        <div>
          <span className='font-satoshi font-semibold text-base text-gray-700'>
            Models <span className='font-normal text-sm'>(up to {MAX_MODELS})</span>
          </span>
          <div className='mt-2 flex flex-wrap gap-2'>
            {provider?.models.map((model) => (
              <button
                type='button'
                key={model}
                onClick={() => toggleModel(model)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  selected.includes(model)
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                {model}
              </button>
            ))}
          </div>
        </div>

        <label className='flex items-center gap-2 text-sm text-gray-700'>
          <input type='checkbox' checked={judge} onChange={(e) => setJudge(e.target.checked)} />
          Ask a judge model to compare the answers (needs 2+ models)
        </label>

        <div className='flex-end gap-4'>
          {status !== "loading" && !session?.user ? (
            <button type='button' onClick={() => signIn("google")} className='black_btn'>
              Sign in to run
            </button>
          ) : (
            <button
              type='submit'
              disabled={running || selected.length === 0 || !prompt.trim()}
              className='px-5 py-1.5 text-sm bg-primary-orange rounded-full text-white disabled:opacity-50'
            >
              {running ? "Running..." : `Run on ${selected.length} model${selected.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </form>

      {error && <p className='mt-6 text-sm text-red-600'>{error}</p>}

      {output?.verdict && (
        <div className='mt-10 w-full rounded-lg border border-amber-300 bg-amber-50/80 p-5'>
          {output.verdict.error ? (
            <p className='text-sm text-red-600'>{output.verdict.error}</p>
          ) : (
            <>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 className='font-satoshi text-lg font-bold text-gray-900'>Judge verdict</h2>
                <Stat>winner: {output.verdict.winner}</Stat>
                <Stat>judge: {output.verdict.model}</Stat>
              </div>
              <p className='mt-2 text-sm text-gray-700'>{output.verdict.summary}</p>
              <h3 className='mt-4 font-satoshi font-semibold text-gray-900'>Combined best answer</h3>
              <p className='mt-1 whitespace-pre-wrap text-sm text-gray-800'>{output.verdict.best_answer}</p>
            </>
          )}
        </div>
      )}

      {output && (
        <div className='mt-6 mb-16 grid w-full gap-4 md:grid-cols-2'>
          {output.results.map((r) => (
            <div
              key={r.model}
              className={`prompt_card !max-w-none ${
                output.verdict?.winner === r.model ? "ring-2 ring-amber-400" : ""
              }`}
            >
              <div className='flex flex-wrap items-center gap-2'>
                <h3 className='font-satoshi font-semibold text-gray-900'>{r.model}</h3>
                {r.ok && <Stat>{(r.ms / 1000).toFixed(1)}s</Stat>}
                {r.ok && r.outputTokens != null && <Stat>{r.outputTokens} tokens</Stat>}
              </div>
              {r.ok ? (
                <p className='mt-3 whitespace-pre-wrap text-sm text-gray-700'>{r.text}</p>
              ) : (
                <p className='mt-3 text-sm text-red-600'>{r.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default Playground;
