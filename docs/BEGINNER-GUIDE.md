# Cueglass: a step-by-step guide

This guide explains how to install Cueglass, try it, and get your first answer.

You need a Windows computer. Windows 11 is recommended.

## 1. Download Cueglass

1. Open the [Cueglass download page](https://github.com/legendary-cookie/cueglass-desktop/releases/latest).
2. Find **Assets** near the bottom of the release. Click it if the download list is hidden.
3. Download the file whose name starts with **Cueglass-Setup** and ends with **.exe**. For version 0.6.0, it is `Cueglass-Setup-0.6.0-x64.exe`.
4. Also download **SHA256SUMS.txt**. This lets you check that the installer downloaded correctly.

Choose the installer rather than either of the **Source code** downloads.

### Check the download

The current installer is unsigned, so Windows may show a warning. Do not turn off Windows security. On a work computer, ask your IT team if installation is blocked.

To check version 0.6.0:

1. Open **File Explorer** and go to the folder containing your download, usually **Downloads**.
2. Click the address bar at the top, type `powershell`, and press **Enter**.
3. Paste this command and press **Enter**:

   ```powershell
   Get-FileHash .\Cueglass-Setup-0.6.0-x64.exe -Algorithm SHA256
   ```

4. Open **SHA256SUMS.txt** in Notepad.
5. Compare the long code beside the installer filename with the code shown in PowerShell. Every letter and number must match; uppercase and lowercase do not matter.

If they differ, do not run the installer. Download it again. If you downloaded a newer version, replace the filename in the command with that file's name.

This check confirms that the file matches the published download. It does not verify the publisher's identity.

## 2. Install and open Cueglass

1. Double-click the downloaded installer.
2. Follow the instructions in the installer window.
3. When installation finishes, find **Cueglass (installed)** on your desktop and double-click it.

Cueglass does not open automatically after installation. You can also find it by opening the Windows Start menu and typing **Cueglass**.

If you already have another copy open, save any session you want to keep and quit that copy first.

## 3. Try it without connecting an account

Start here to learn the controls.

1. Open **Controls**.
2. Leave the speech preset on **Balanced**. The required speech files are already included.
3. Choose the language you will speak, such as **English**.
4. Select **Offline practice**.
5. Choose **Microphone** as your audio source, then select your microphone if asked.
6. Press **Start**.
7. Say a short question, such as: “How can I prepare for an interview?”
8. Check that your words appear on screen. You can correct the text if it heard you incorrectly.
9. Press **Answer now**.

Offline practice shows a labelled example response. It does not generate an AI answer. You do not need an AI account for this practice.

Press **Pause** or **Stop** when you finish.

## 4. Connect an account for AI answers

Online AI answers need a supported account or your own provider key. A provider key is a private access code from an AI service; separate usage charges may apply.

1. Open **Accounts**.
2. Choose the service you want to use.
3. If using ChatGPT, follow the **Sign in with ChatGPT** instructions. Availability depends on your account and the service.
4. If using another supported service, enter your own key where requested. Keep that key private.
5. Select your connected account and press **Refresh catalog** to load its available AI models.
6. Choose an available model. If **Auto** is available, you can start with that.

You can stay with Offline practice if you do not want to connect an account yet.

## 5. Get your first AI answer

1. Choose your connected service and model instead of **Offline practice**.
2. Keep one answer card to start with. Extra cards make extra requests and may increase charges.
3. Choose **Microphone** to use your microphone, or **System playback** to capture sound playing through your computer, including through headphones.
4. Only capture audio you have permission to use. System playback can also pick up notifications and other applications.
5. Press **Start**.
6. Speak a question, or let the permitted audio play.
7. Read the words that appear. Correct any mistakes.
8. Allow text sharing if prompted and you want the selected online service to receive the text.
9. Press **Answer now**.
10. Press **Pause** or **Stop** when finished.

Speech is transcribed on your computer. Asking an online service for an answer sends the question text to that service.

## 6. Hide, reopen or quit Cueglass

- **Hide the window:** close or minimise it. This also pauses audio.
- **Bring it back:** find the Cueglass icon beside the Windows clock. You may need to click the small upward arrow first. Right-click the icon and choose **Show**.
- **Continue listening:** press **Start** again. Showing the window does not restart listening.
- **Exit completely:** right-click the Cueglass icon beside the clock and choose **Quit**.

## If something does not work

### My words are not appearing

1. Check that you pressed **Start**.
2. Check that the selected microphone is the one you are using.
3. Check that the microphone is not muted.
4. Open Windows **Settings → Privacy & security → Microphone** and check that microphone access is allowed.
5. Return to Cueglass and try a short sentence again.

### Cueglass hears the wrong words

Choose the language you are speaking, move closer to the microphone, and reduce background noise. Correct the text before pressing **Answer now**.

### I hear computer audio, but Cueglass does not

Choose **System playback** and check that the selected output device matches the speakers or headphones you are using. Changing the source pauses capture, so press **Start** again.

### I only get an example response

You are using **Offline practice**. Follow step 4 above to connect an account, then choose that service and an available model.

### I signed in, but cannot get an AI answer

Press **Refresh catalog**, then select an available model. Signing in does not guarantee that a model is available to your account. Check any error message and your internet connection. Support across accounts and providers has not been fully verified.

### I cannot find the window

Look for the Cueglass icon beside the Windows clock, including under the upward arrow. Right-click it and choose **Show**.

For more help, see the [troubleshooting guide](https://github.com/legendary-cookie/cueglass-desktop/blob/main/docs/TROUBLESHOOTING.md).

---

Based on the published [installation guide](https://github.com/legendary-cookie/cueglass-desktop/blob/main/docs/QUICKSTART.md) and [user guide](https://github.com/legendary-cookie/cueglass-desktop/blob/main/docs/USER-GUIDE.md). Button names and setup details reflect the documented 0.6.0 release. These steps have not been tested in the running app.
