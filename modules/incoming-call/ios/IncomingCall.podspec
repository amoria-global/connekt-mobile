require 'json'

Pod::Spec.new do |s|
  s.name           = 'IncomingCall'
  s.version        = '1.0.0'
  s.summary        = 'Native incoming offer notification helper for Android and iOS'
  s.description    = 'Schedules and manages high-priority incoming offer notifications with custom sounds and category actions on Android and iOS.'
  s.author         = 'Amoria Global Tech Ltd'
  s.homepage       = 'https://connekyt.com'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
