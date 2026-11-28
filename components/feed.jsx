"use client";

import { useState, useEffect, useMemo } from "react";

import PromptCard from "./promptCard";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PromptCardList = ({ data, handleTagClick }) => (
  <div className='mt-10 prompt_layout'>
    {data.map((post) => (
      <PromptCard key={post._id} post={post} handleTagClick={handleTagClick} />
    ))}
  </div>
);

const SORTS = [
  ["new", "Newest"],
  ["popular", "Most liked"],
];

const Feed = () => {
  const [allPosts, setAllPosts] = useState([]);
  const [sort, setSort] = useState("new");
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/prompt?sort=${sort}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAllPosts)
      .finally(() => setLoading(false));
  }, [sort]);

  // Debounce typing so we don't filter on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const visible = useMemo(() => {
    const term = debounced.trim().replace(/^#/, "");
    if (!term) return allPosts;
    // Escape the text so symbols like "(" or "+" are searched literally instead of crashing
    const regex = new RegExp(escapeRegex(term), "i");
    return allPosts.filter(
      (item) =>
        regex.test(item.creator?.username ?? "") || regex.test(item.tag) || regex.test(item.prompt)
    );
  }, [allPosts, debounced]);

  const handleTagClick = (tagName) => {
    setSearchText(tagName);
    setDebounced(tagName);
  };

  return (
    <section className='feed'>
      <form className='relative w-full flex-center' onSubmit={(e) => e.preventDefault()}>
        <input
          type='text'
          placeholder='Search for a tag, username or text'
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className='search_input peer'
        />
      </form>

      <div className='mt-6 flex gap-2'>
        {SORTS.map(([value, label]) => (
          <button
            key={value}
            type='button'
            onClick={() => setSort(value)}
            className={`rounded-full border px-4 py-1 text-sm ${
              sort === value
                ? "border-black bg-black text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className='mt-10 text-sm text-gray-500'>Loading prompts...</p>
      ) : visible.length === 0 ? (
        <p className='mt-10 text-sm text-gray-500'>No prompts found.</p>
      ) : (
        <PromptCardList data={visible} handleTagClick={handleTagClick} />
      )}
    </section>
  );
};

export default Feed;
