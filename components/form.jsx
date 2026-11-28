"use client";

import { useState } from "react";
import Link from "next/link";

const Form = ({ type, post, setPost, submitting, handleSubmit, error }) => {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [aiError, setAiError] = useState("");

  const askAI = async () => {
    setSuggesting(true);
    setAiError("");
    setSuggestion(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: post.prompt }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuggestion(await res.json());
    } catch (err) {
      setAiError(err.message || "AI suggestion failed");
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <section className='w-full max-w-full flex-start flex-col'>
      <h1 className='head_text text-left'>
        <span className='blue_gradient'>{type} Post</span>
      </h1>
      <p className='desc text-left max-w-md'>
        {type} and share prompts with the community. Not sure it&apos;s good yet? Let AI suggest
        improvements and tags, then test it in the Playground.
      </p>

      <form
        onSubmit={handleSubmit}
        className='mt-10 w-full max-w-2xl flex flex-col gap-7 glassmorphism'
      >
        <label>
          <span className='font-satoshi font-semibold text-base text-gray-700'>Your AI Prompt</span>
          <textarea
            value={post.prompt}
            onChange={(e) => setPost({ ...post, prompt: e.target.value })}
            placeholder='Write your post here'
            maxLength={4000}
            required
            className='form_textarea'
          />
        </label>

        <div className='-mt-4 flex flex-col gap-3'>
          <button
            type='button'
            onClick={askAI}
            disabled={suggesting || !post.prompt.trim()}
            className='self-start rounded-full border border-gray-800 px-4 py-1 text-sm text-gray-800 disabled:opacity-40'
          >
            {suggesting ? "Thinking..." : "✨ Improve with AI"}
          </button>
          {aiError && <p className='text-sm text-red-600'>{aiError}</p>}

          {suggestion && (
            <div className='rounded-lg border border-gray-200 bg-white/70 p-4 text-sm'>
              {suggestion.improved && (
                <>
                  <p className='font-semibold text-gray-800'>Suggested version</p>
                  <p className='mt-1 whitespace-pre-wrap text-gray-700'>{suggestion.improved}</p>
                  {suggestion.reason && (
                    <p className='mt-2 text-xs text-gray-500'>Why: {suggestion.reason}</p>
                  )}
                </>
              )}
              <div className='mt-3 flex flex-wrap items-center gap-2'>
                {suggestion.improved && (
                  <button
                    type='button'
                    className='black_btn !py-1 !text-xs'
                    onClick={() => {
                      setPost({ ...post, prompt: suggestion.improved });
                      setSuggestion({ ...suggestion, improved: "" });
                    }}
                  >
                    Use this version
                  </button>
                )}
                {suggestion.tags.map((t) => (
                  <button
                    type='button'
                    key={t}
                    onClick={() => setPost({ ...post, tag: t })}
                    className='rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200'
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <label>
          <span className='font-satoshi font-semibold text-base text-gray-700'>
            Field of Prompt{" "}
            <span className='font-normal'>(#product, #webdevelopment, #idea, etc.)</span>
          </span>
          <input
            value={post.tag}
            onChange={(e) => setPost({ ...post, tag: e.target.value })}
            type='text'
            placeholder='#Tag'
            required
            className='form_input'
          />
        </label>

        {error && <p className='text-sm text-red-600'>{error}</p>}

        <div className='flex-end mx-3 mb-5 gap-4'>
          <Link href='/' className='text-gray-500 text-sm'>
            Cancel
          </Link>
          <button
            type='submit'
            disabled={submitting}
            className='px-5 py-1.5 text-sm bg-primary-orange rounded-full text-white'
          >
            {submitting ? "Saving..." : type}
          </button>
        </div>
      </form>
    </section>
  );
};

export default Form;
