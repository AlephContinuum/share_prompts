"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Form from "@components/form";

const CreatePrompt = () => {
  const router = useRouter();
  const [submitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [post, setPost] = useState({ prompt: "", tag: "" });

  const createPrompt = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      // No userId here: the server reads it from the login session.
      const response = await fetch("/api/prompt/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: post.prompt, tag: post.tag }),
      });
      if (!response.ok) throw new Error(await response.text());
      router.push("/");
    } catch (err) {
      setError(err.message || "Could not create prompt");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form
      type='Create'
      post={post}
      setPost={setPost}
      submitting={submitting}
      handleSubmit={createPrompt}
      error={error}
    />
  );
};

export default CreatePrompt;
