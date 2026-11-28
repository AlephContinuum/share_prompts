import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";

import User from "@models/user";
import { connectToDB } from "@utils/database";

const makeUsername = (profile) => {
  let username = profile.name
    ? profile.name.replace(/\s+/g, "").toLowerCase()
    : profile.email.split("@")[0];

  username = username.replace(/[^a-z0-9._]/g, "");
  if (username.length < 8) username = `${username}${Math.floor(Math.random() * 9000 + 1000)}`;
  if (username.length > 20) username = username.slice(0, 20);
  username = username.replace(/^[_.]+|[_.]+$/g, "").replace(/[_.]{2,}/g, ".");
  if (username.length < 8) {
    username = `${username}${Math.floor(Math.random() * 9000000 + 1000000)}`.slice(0, 20);
  }
  return username;
};

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Store the database user id inside the signed JWT once, at sign-in.
    // Later session checks then read it from the token instead of querying MongoDB
    // on every request (faster, and works even while the DB is still connecting).
    async jwt({ token }) {
      if (!token.id && token.email) {
        try {
          await connectToDB();
          const user = await User.findOne({ email: token.email }).select("_id");
          if (user) token.id = user._id.toString();
        } catch (error) {
          console.error("JWT user lookup failed:", error.message); // retried on next request
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token?.id) session.user.id = token.id;
      return session;
    },

    async signIn({ profile }) {
      try {
        await connectToDB();
        const userExists = await User.findOne({ email: profile.email });

        if (!userExists) {
          await User.create({
            email: profile.email,
            username: makeUsername(profile),
            image: profile.picture,
          });
        }
        return true;
      } catch (error) {
        console.error("NextAuth signIn error:", error);
        return false;
      }
    },
  },
};

/**
 * Returns the logged-in user's id (string) or null.
 * All write endpoints use this instead of trusting a userId sent by the browser.
 */
export const getSessionUserId = async () => {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
};

export const unauthorized = () => new Response("You must be signed in", { status: 401 });
export const forbidden = () => new Response("You can only change your own prompts", { status: 403 });
