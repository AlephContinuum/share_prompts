"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import Profile from "@components/profile";

const UserProfileContent = () => {
  const { id } = useParams();
  const userName = useSearchParams().get("name") ?? "User";
  const [userPosts, setUserPosts] = useState([]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/users/${id}/posts`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setUserPosts);
  }, [id]);

  return <Profile name={`${userName}'s`} desc={`Prompts shared by ${userName}.`} data={userPosts} />;
};

const UserProfile = () => (
  <Suspense>
    <UserProfileContent />
  </Suspense>
);

export default UserProfile;
