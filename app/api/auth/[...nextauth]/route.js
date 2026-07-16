import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import User from "../../../../models/user";
import { connectToDB } from "../../../../utils/database";

 const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_ID,
            clientSecret:process.env.GOOGLE_CLIENT_SECRET,
        })
    ],
    callbacks:{
        async session({ session }) {
    await connectToDB();

    const sessionUser = await User.findOne({
        email: session.user.email,
    });

    if (sessionUser) {
        session.user.id = sessionUser._id.toString();
    }

    return session;
},

        async signIn({ profile }){
            try{
                await connectToDB();
                
                //check if user exists
                const userExists = await User.findOne({
                    email: profile.email
                });
                
                //create user
                if (!userExists) {
                    let username = profile.name
                        ? profile.name.replace(/\s+/g, "").toLowerCase()
                        : profile.email.split("@")[0];

                    username = username.replace(/[^a-z0-9._]/g, "");

                    if (username.length < 8) {
                        const suffix = Math.floor(Math.random() * 9000 + 1000);
                        username = `${username}${suffix}`;
                    }

                    if (username.length > 20) {
                        username = username.slice(0, 20);
                    }

                    username = username.replace(/^[_\.]+|[_\.]+$/g, "").replace(/[_\.]{2,}/g, ".");

                    if (username.length < 8) {
                        username = `${username}${Math.floor(Math.random() * 9000000 + 1000000)}`.slice(0, 20);
                    }

                    await User.create({
                        email: profile.email,
                        username,
                        image: profile.picture,
                    });
                }

                return true;
            } catch (error) {
                console.error("NextAuth signIn error:", error, "profile:", profile);
                return false;
            }
        },
        }});

export { handler as GET, handler as POST };