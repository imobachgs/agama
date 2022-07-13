# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require_relative "../../../test_helper"
require "dinstaller/dbus/base_object"
require "dinstaller/dbus/interfaces/progress"
require "dinstaller/with_progress"
require "dinstaller/progress"

class DBusObjectWithProgressInterface < DInstaller::DBus::BaseObject
  include DInstaller::DBus::Interfaces::Progress

  def initialize
    super("org.opensuse.DInstaller.UnitTests")
  end

  def backend
    @backend ||= Backend.new
  end

  class Backend
    include DInstaller::WithProgress
  end
end

describe DBusObjectWithProgressInterface do
  let(:progress) { subject.backend.progress }

  let(:progress_interface) { DInstaller::DBus::Interfaces::Progress::PROGRESS_INTERFACE }

  it "defines Progress D-Bus interface" do
    expect(subject.intfs.keys).to include(progress_interface)
  end

  describe "#progress_total_steps" do
    context "if there is no progress" do
      it "returns 0" do
        expect(subject.progress_total_steps).to eq(0)
      end
    end

    context " if there is a progress" do
      before do
        subject.backend.start_progress(2)
      end

      it "returns the total number of steps of the progress" do
        expect(subject.progress_total_steps).to eq(2)
      end
    end
  end

  describe "#progress_current_step" do
    context "if there is no progress" do
      it "returns id 0 and empty descreption" do
        expect(subject.progress_current_step).to eq([0, ""])
      end
    end

    context " if there is a progress" do
      before do
        subject.backend.start_progress(2)
      end

      before do
        progress.step("test")
      end

      it "returns the id and description of the current step" do
        expect(subject.progress_current_step).to eq([1, "test"])
      end
    end
  end

  describe "#progress_finished" do
    context "if there is no progress" do
      it "returns true" do
        expect(subject.progress_finished).to eq(true)
      end
    end

    context " if there is a progress" do
      before do
        subject.backend.start_progress(2)
      end

      context "and the progress is not started" do
        it "returns false" do
          expect(subject.progress_finished).to eq(false)
        end
      end

      context "and the progress is started but not finished yet" do
        before do
          progress.step("step 1")
        end

        it "returns false" do
          expect(subject.progress_finished).to eq(false)
        end
      end

      context "and the progress is finished" do
        before do
          progress.step("step 1")
          progress.step("step 2")
        end

        it "returns true" do
          expect(subject.progress_finished).to eq(true)
        end
      end
    end
  end

  describe "#progress_properties" do
    before do
      subject.backend.start_progress(2)
      progress.step("step 1")
    end

    it "returns de D-Bus properties of the progress interface" do
      expected_properties = {
        "TotalSteps"  => 2,
        "CurrentStep" => [1, "step 1"],
        "Finished"    => false
      }
      expect(subject.progress_properties).to eq(expected_properties)
    end
  end

  describe "#register_progress_callbacks" do
    it "register callbacks to be called when the progress changes" do
      subject.register_progress_callbacks
      subject.backend.start_progress(2)

      expect(subject).to receive(:dbus_properties_changed)
        .with(progress_interface, anything, anything)

      progress.step("step 1")
    end

    it "register callbacks to be called when the progress finishes" do
      subject.register_progress_callbacks
      subject.backend.start_progress(2)

      expect(subject).to receive(:dbus_properties_changed)
        .with(progress_interface, anything, anything)

      progress.finish
    end
  end
end
