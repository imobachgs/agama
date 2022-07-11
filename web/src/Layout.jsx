/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";

import "./layout.scss";
import logo from "./assets/suse-horizontal-logo.svg";
import { createTeleporter } from "react-teleporter";

const PageTitle = createTeleporter();
const HeaderActions = createTeleporter();
const HeaderIcon = createTeleporter();
const FooterActions = createTeleporter();
const FooterInfoArea = createTeleporter();

/**
 * D-Installer main layout component.
 *
 * It displays the content in a single vertical responsive column with sticky
 * header and fixed footer.
 *
 * @example
 *   <Layout
 *     sectionTitle="Software"
 *     SectionIcon={SoftwareSectionIcon}
 *     FooterActions={SoftwareSectionActions}
 *   >
 *     <SoftwareSection />
 *   </Layout>
 *
 * @param {object} props - component props
 * @param {React.ReactNode} [props.SectionIcon] - the section icon in the header
 * @param {React.ReactNode} [props.children] - the section content
 *
 */
function Layout({ children }) {
  const responsiveWidthRules = "pf-u-w-66-on-lg pf-u-w-50-on-xl pf-u-w-33-on-2xl";
  const className = `layout ${responsiveWidthRules}`;

  const renderHeader = () => {
    return (
      <div className="layout__header">
        <div className="layout__header-section-title">
          <h1>
            <HeaderIcon.Target as="span" className="layout__header-section-title-icon" />
            <PageTitle.Target as="span" />
          </h1>
        </div>

        <HeaderActions.Target className="layout__header-section-actions" />
      </div>
    );
  };

  const renderFooter = () => (
    <div className="layout__footer">
      <div className="layout__footer-info-area">
        <img src={logo} alt="Logo of SUSE" className="company-logo" />
        <FooterInfoArea.Target />
      </div>
      <FooterActions.Target
        className="layout__footer-actions-area"
        role="navigation"
        aria-label="Installer Actions"
      />
    </div>
  );

  return (
    <div className={className}>
      {renderHeader()}

      <main className="layout__content">{children}</main>

      {renderFooter()}
    </div>
  );
}

const Title = PageTitle.Source;
const PageIcon = HeaderIcon.Source;
const PageActions = HeaderActions.Source;
const MainActions = FooterActions.Source;
const AdditionalInfo = FooterInfoArea.Source;

export {
  Layout as default,
  Title,
  PageIcon,
  PageActions,
  MainActions,
  AdditionalInfo
};
