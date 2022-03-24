# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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

require "pathname"
require "yast"
require "dinstaller/package_callbacks"
require "y2packager/product"

Yast.import "InstURL"
Yast.import "PackageInstallation"
Yast.import "Pkg"
Yast.import "Stage"

# YaST specific code lives under this namespace
module DInstaller
  # This class is responsible for software handling
  class Software
    GPG_KEYS_PATH = "/"
    private_constant :GPG_KEYS_PATH

    FALLBACK_REPO = "https://download.opensuse.org/tumbleweed/repo/oss/"
    private_constant :FALLBACK_REPO

    SUPPORTED_PRODUCTS = ["Leap", "openSUSE"].freeze
    private_constant :SUPPORTED_PRODUCTS

    attr_reader :product, :products

    def initialize(logger)
      @logger = logger
      @products = []
      @product = "" # do not use nil here, otherwise dbus crash
    end

    def select_product(name)
      raise ArgumentError unless @products.any? { |p| p.name == name }

      @product = name
    end

    def probe(progress)
      logger.info "Probing software"
      Yast::Pkg.SetSolverFlags(
        "ignoreAlreadyRecommended" => false, "onlyRequires" => true
      )

      # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
      Yast::Stage.Set("normal")
      progress.init_minor_steps(3, "Initialiaze target repositories")
      Yast::Pkg.TargetInitialize("/")
      import_gpg_keys

      progress.next_minor_step("Initialize sources")
      add_base_repo

      progress.next_minor_step("Searching for supported products")
      @products = find_products
      @product = @products.first&.name || ""
      raise "No product available" if @product.empty?

      progress.next_minor_step("Making initial proposal")
      proposal = Yast::Packages.Proposal(force_reset = true, reinit = false, _simple = true)
      logger.info "proposal #{proposal["raw_proposal"]}"
      progress.next_minor_step("Software probing finished")
      Yast::Stage.Set("initial")
    end

    def propose
      Yast::Pkg.TargetInitialize(Yast::Installation.destdir)
      Yast::Pkg.TargetLoad
      selected_product = @products.find { |p| p.name == @product }
      selected_product.select
      logger.info "selected product #{selected_product.inspect}"

      # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
      Yast::Stage.Set("normal")
      # FIXME: workaround to have at least reasonable proposal
      Yast::PackagesProposal.AddResolvables("the-installer", :pattern, ["base", "enhanced_base"])
      proposal = Yast::Packages.Proposal(force_reset = false, reinit = false, _simple = true)
      logger.info "proposal #{proposal["raw_proposal"]}"
      res = Yast::Pkg.PkgSolve(unused = true)
      logger.info "solver run #{res.inspect}"

      Yast::Stage.Set("initial")
      # do not return proposal hash, so intentional nil here
      nil
    end

    def install(progress)
      PackageCallbacks.setup(progress, count_packages)

      # TODO: error handling
      commit_result = Yast::PackageInstallation.Commit({})

      if commit_result.nil? || commit_result.empty?
        logger.error("Commit failed")
        raise Yast::Pkg.LastError
      end

      logger.info "Commit result #{commit_result}"
    end

    # Writes the repositories information to the installed system
    #
    # @param _progress [Progress] Progress reporting object
    def finish(_progress)
      Yast::Pkg.SourceSaveAll
      Yast::Pkg.TargetFinish
      Yast::Pkg.SourceCacheCopyTo(Yast::Installation.destdir)
    end

  private

    # @return [Logger]
    attr_reader :logger

    def count_packages
      Yast::Pkg.PkgMediaCount.reduce(0) { |sum, res| sum + res.reduce(0, :+) }
    end

    def import_gpg_keys
      gpg_keys = Pathname.new(GPG_KEYS_PATH).glob("*.gpg").map(&:to_s)
      logger.info "Importing GPG keys: #{gpg_keys}"
      gpg_keys.each do |path|
        Yast::Pkg.ImportGPGKey(path.to_s, true)
      end
    end

    def add_base_repo
      base_url = Yast::InstURL.installInf2Url("")
      base_url = FALLBACK_REPO if base_url.empty?
      Yast::Pkg.SourceCreateBase(base_url, "/")
      Yast::Pkg.SourceSaveAll
    end

    def find_products
      supported_products = Y2Packager::Product.available_base_products.select do |product|
        SUPPORTED_PRODUCTS.include?(product.name)
      end
      logger.info "Supported products found: #{supported_products.map(&:name).join(",")}"
      supported_products
    end
  end
end
