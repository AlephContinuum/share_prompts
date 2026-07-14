import React from "react";
import Feed from '@components/feed';
import Form from '@components/form';


const Home = () => {
  return (
    <section className="w-full flex flex-col items-center">
      <h1 className="head_text text-center">
        Discover & Share
        <br className="max-md:hidden" />
        <span className="orange_gradient text-center"> AI-Powered Prompts </span>
      </h1>
      <p className="desc text-center">
        Promptopia is an open-sourceAI prompting tool for mordern world to discover, create and share creative prompts
      </p>

      <Feed />
    </section>
   )
}

export default Home;