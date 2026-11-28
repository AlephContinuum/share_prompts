"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Form from "@components/form";

const UpdatePromptForm = () => {
  const router = useRouter();
  const promptId = useSearchParams().get("id");

  const [post, setPost] = useState({ prompt: "", tag: "" });
  const [submitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!promptId) return;
    fetch(`/api/prompt/${promptId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Prompt not found"))))
      .then((data) => setPost({ prompt: data.prompt, tag: data.tag }))
      .catch((err) => setError(err.message));
  }, [promptId]);

  const updatePrompt = async (e) => {
    e.preventDefault();
    if (!promptId) return setError("Missing prompt id");
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/prompt/${promptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: post.prompt, tag: post.tag }),
      });
      if (!response.ok) throw new Error(await response.text());
      router.push("/profile");
    } catch (err) {
      setError(err.message || "Could not update prompt");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form
      type='Edit'
      post={post}
      setPost={setPost}
      submitting={submitting}
      handleSubmit={updatePrompt}
      error={error}
    />
  );
};

// useSearchParams needs a Suspense boundary for the production build
const UpdatePrompt = () => (
  <Suspense>
    <UpdatePromptForm />
  </Suspense>
);

export default UpdatePrompt;
