export const metadata = {
  title: "Privacy Policy – PromptLab",
  description: "How PromptLab handles your data",
};

const Section = ({ title, children }) => (
  <section className='mt-8'>
    <h2 className='font-satoshi text-xl font-semibold text-gray-900'>{title}</h2>
    <div className='mt-2 space-y-2 text-sm leading-relaxed text-gray-700'>{children}</div>
  </section>
);

const PrivacyPage = () => (
  <article className='w-full max-w-3xl pb-16'>
    <h1 className='head_text text-left'>
      <span className='blue_gradient'>Privacy Policy</span>
    </h1>
    <p className='mt-4 text-sm text-gray-500'>Last updated: 28 November 2026</p>

    <p className='desc text-left'>
      PromptLab is a personal portfolio project for sharing AI prompts and comparing how different AI
      models answer them. This page explains what data it uses and why.
    </p>

    <Section title='Signing in with Google'>
      <p>
        When you sign in with Google, PromptLab receives your name, email address and profile picture.
        Your email address is stored to recognise your account and is never shown to other users. Your
        username and profile picture are shown next to prompts you post.
      </p>
      <p>PromptLab does not get your Google password or access to any other Google data.</p>
    </Section>

    <Section title='Prompts you post'>
      <p>
        Prompts and tags you post are public: anyone visiting the site can read them. Likes are stored so
        each user can like a prompt once. You can edit or delete your own prompts at any time from your
        profile.
      </p>
    </Section>

    <Section title='AI features'>
      <p>
        When you use the Playground or &ldquo;Improve with AI&rdquo;, the text of your prompt is sent to
        third-party AI providers to generate answers. Depending on the models selected, these can include
        Groq, Google Gemini, NVIDIA, Verda, OpenAI and DeepSeek. Their own privacy policies apply to that
        text.
      </p>
      <p>
        Playground answers are not saved by PromptLab; only a count of how many times a prompt was run is
        stored. Please don&apos;t enter passwords, personal details or other sensitive information.
      </p>
    </Section>

    <Section title='Cookies'>
      <p>
        PromptLab uses a single sign-in session cookie to keep you logged in. There are no advertising or
        analytics cookies.
      </p>
    </Section>

    <Section title='Where data is stored'>
      <p>
        The app is hosted on AWS Amplify and data is stored in MongoDB Atlas. PromptLab does not sell or
        share your data with anyone other than the services needed to run it.
      </p>
    </Section>

    <Section title='Deleting your data or contacting the developer'>
      <p>
        To have your account removed, or for any questions about this policy, open an issue on the
        project&apos;s{" "}
        <a
          href='https://github.com/AlephContinuum/share_prompts/issues'
          className='text-blue-600 underline'
          target='_blank'
          rel='noopener noreferrer'
        >
          GitHub repository
        </a>
        .
      </p>
    </Section>
  </article>
);

export default PrivacyPage;
