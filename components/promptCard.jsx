"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

const timeAgo = (date) => {
  if (!date) return "";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const units = [
    ["y", 31536000],
    ["mo", 2592000],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  const [label, size] = units.find(([, size]) => s >= size);
  return `${Math.floor(s / size)}${label} ago`;
};

const PromptCard = ({ post, handleEdit, handleDelete, handleTagClick }) => {
  const { data: session } = useSession();
  const pathName = usePathname();
  const router = useRouter();
  const userId = session?.user?.id;

  const [copied, setCopied] = useState(false);
  const [likes, setLikes] = useState(post.likes?.length ?? 0);
  const [liked, setLiked] = useState(Boolean(userId && post.likes?.includes(userId)));

  const creator = post.creator ?? { username: "deleted user", image: "/assets/images/logo.svg" };
  // Older prompts were saved with a leading "#" and without timestamps.
  const tag = (post.tag ?? "").replace(/^#+/, "");
  // A MongoDB ObjectId starts with its creation time (seconds, hex), so use that as a fallback.
  const createdAt = post.createdAt ?? new Date(parseInt(String(post._id).slice(0, 8), 16) * 1000);

  const handleProfileClick = () => {
    if (!post.creator) return;
    if (post.creator._id === userId) return router.push("/profile");
    router.push(`/profile/${post.creator._id}?name=${encodeURIComponent(post.creator.username)}`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(post.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleLike = async () => {
    if (!userId) return alert("Sign in to like prompts");
    // Optimistic update, then reconcile with the server's answer
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    const res = await fetch(`/api/prompt/${post._id}/like`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikes(data.likes);
    } else {
      setLiked(liked);
      setLikes(post.likes?.length ?? 0);
    }
  };

  return (
    <div className='prompt_card'>
      <div className='flex justify-between items-start gap-5'>
        <div
          className='flex-1 flex justify-start items-center gap-3 cursor-pointer'
          onClick={handleProfileClick}
        >
          <Image
            src={creator.image || "/assets/images/logo.svg"}
            alt='user_image'
            width={40}
            height={40}
            className='rounded-full object-contain'
          />
          <div className='flex flex-col'>
            <h3 className='font-satoshi font-semibold text-gray-900'>{creator.username}</h3>
            <p className='font-inter text-xs text-gray-500'>{timeAgo(createdAt)}</p>
          </div>
        </div>

        <button type='button' className='copy_btn' onClick={handleCopy} aria-label='Copy prompt'>
          <Image
            src={copied ? "/assets/icons/tick.svg" : "/assets/icons/copy.svg"}
            alt={copied ? "tick_icon" : "copy_icon"}
            width={12}
            height={12}
          />
        </button>
      </div>

      <p className='my-4 font-satoshi text-sm text-gray-700 whitespace-pre-wrap'>{post.prompt}</p>
      <p
        className='font-inter text-sm blue_gradient cursor-pointer'
        onClick={() => handleTagClick && handleTagClick(tag)}
      >
        #{tag}
      </p>

      <div className='mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm'>
        <button
          type='button'
          onClick={handleLike}
          className={`flex items-center gap-1 ${liked ? "text-rose-600" : "text-gray-500"}`}
          aria-pressed={liked}
        >
          {liked ? "♥" : "♡"} {likes}
        </button>
        {post.runCount > 0 && <span className='text-xs text-gray-400'>run {post.runCount}×</span>}
        <Link href={`/playground?id=${post._id}`} className='font-semibold text-gray-800 hover:underline'>
          Try it ▶
        </Link>
      </div>

      {userId === post.creator?._id && pathName === "/profile" && (
        <div className='mt-3 flex-center gap-4 border-t border-gray-100 pt-3'>
          <p className='font-inter text-sm green_gradient cursor-pointer' onClick={handleEdit}>
            Edit
          </p>
          <p className='font-inter text-sm orange_gradient cursor-pointer' onClick={handleDelete}>
            Delete
          </p>
        </div>
      )}
    </div>
  );
};

export default PromptCard;
