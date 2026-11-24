import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components/layouts";

export const Header = () => {
  return (
    <AppHeader>
      <AppHeader.Navigation>
        <AppHeader.Logo as={Link} to="/" />
        <AppHeader.NavigationItem as={Link} to="/data">
          Explore Data
        </AppHeader.NavigationItem>
        <AppHeader.NavigationItem as={Link} to="/sankey">
          Sankey Chart
        </AppHeader.NavigationItem>
      </AppHeader.Navigation>
    </AppHeader>
  );
};
