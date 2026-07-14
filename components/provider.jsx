"use Client";
import React, { Children } from "react";

import { SessionProvider } from "@node_modules/next-auth/react";

const Provider = ({ Children, session }) => {
    return(
        <SessionProvider session={session}>
            {children}
        </SessionProvider>
    )
}

export default Provider