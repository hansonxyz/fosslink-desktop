; FossLink custom installer additions
;
; /silent  - silent install: skips all prompts, auto-uninstalls previous version,
;            installs new version. Alias for NSIS /S flag.
;
; /run     - launch FossLink after a silent install completes.
;            (In non-silent mode the finish-page "Launch" checkbox handles this.)

; preInit runs inside .onInit, before standard initialization.
; Enables silent mode when /silent flag is passed.
!macro preInit
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/silent" $R1
  ${IfNot} ${Errors}
    SetSilent silent
  ${EndIf}
!macroend

; customInstall runs at the end of the install section, before the finish page.
; Launches the app when /run is combined with silent mode.
!macro customInstall
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/run" $R1
  ${IfNot} ${Errors}
    ${If} ${Silent}
      ${StdUtils.ExecShellAsUser} $0 "$appExe" "open" ""
    ${EndIf}
  ${EndIf}
!macroend
