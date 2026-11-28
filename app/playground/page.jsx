import { Suspense } from "react";
import Playground from "@components/playground";

const PlaygroundPage = () => (
  <Suspense>
    <Playground />
  </Suspense>
);

export default PlaygroundPage;
