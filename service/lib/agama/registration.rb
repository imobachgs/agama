# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "yast"
require "ostruct"
require "suse/connect"

require "y2packager/new_repository_setup"

module Agama
  # Handles everything related to registration of system to SCC, RMT or similar
  class Registration
    attr_reader :reg_code
    attr_reader :email

    # initializes registration with instance of software manager for query about products
    def initialize(software_manager)
      @software = software_manager
      @on_state_change_callbacks = []
    end

    def register(code, email: "")
      target_distro = "ALP-Dolomite-1-x86_64" # TODO: read it
      connect_params = {
        token: code,
        email: email
      }

      login, password = SUSE::Connect::YaST.announce_system(connect_params, target_distro)
      # write the global credentials
      # TODO: check if we can do it in memory for libzypp
      SUSE::Connect::YaST.create_credentials_file(login, password)

      registration.register(email, code, target_distro)
      # TODO: fill it properly for scc
      target_product = OpenStruct.new(
        arch:         "x86_64",
        identifier:   "ALP-Dolomite",
        version:      "1.0",
        release_type: "ALPHA"
      )
      activate_params = {}
      service = SUSE::Connect::YaST.activate_product(target_product, activate_params, email)
      Y2Packager::NewRepositorySetup.instance.add_service(service.name)

      @reg_code = code
      @email = email
    end

    def deregister; end

    def disabled?; end

    def optional?; end

    # callback when state changed like when different product is selected
    def on_state_change(&block)
      @on_state_change_callbacks << block
    end
  end
end
