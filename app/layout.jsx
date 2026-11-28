import '@styles/globals.css';
import Link from 'next/link';
import Nav from '@components/nav';
import Provider from '@components/provider';

export const metadata = {
    title: 'PromptLab',
    description: 'Share AI prompts and test them across models side by side'
}

const RootLayout = ({ children }) => {
    return (
        <html lang="en">
            <body>
                <Provider>
                    <div className="main">
                        <div className="gradient" />
                    </div>
                    
                    <main className="app">
                        <Nav />
                        {children}
                        <footer className="mt-auto w-full py-8 text-center text-xs text-gray-500">
                            <Link href="/privacy" className="hover:underline">Privacy policy</Link>
                            {" · "}
                            <a
                                href="https://github.com/AlephContinuum/share_prompts"
                                className="hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Source on GitHub
                            </a>
                        </footer>
                    </main>
                </Provider>
            </body>
        </html>
    )
}

export default RootLayout;