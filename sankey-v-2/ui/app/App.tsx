import { PageLayout } from "@dynatrace/strato-components/layouts";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Data } from "./pages/Data";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { Sankey } from "./pages/Sankey";

export const App = () => {
  return (
    <PageLayout>
      <PageLayout.Header>
        <Header />
      </PageLayout.Header>
      <PageLayout.Content>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/data" element={<Data />} />
          <Route path="/sankey" element={<Sankey />} />
        </Routes>
      </PageLayout.Content>
    </PageLayout>
  );
};
