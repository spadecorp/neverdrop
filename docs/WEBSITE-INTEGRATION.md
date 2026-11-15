# SPaDe Corp website integration

Your current SPaDe homepage has an Enterprise product entry for Never-drop AI app, with a `Coming soon` label. Once the Windows installer exists in an actual GitHub release, replace **only that entry** with the HTML snippet below. This matches the existing `.p1`, `.ok`, `.btn`, `.pri` and `.dl` classes from your website's source.

```html
<div class="p1">
  <h4>NeverDrop AI <span class="ok">v1.1.0 available</span></h4>
  <p>Chat with your preferred AI models in one desktop workspace. Store conversations locally and manually transfer conversation context between providers.</p>
  <a class="btn pri dl"
     href="https://github.com/spadecorp/neverdrop/releases/latest/download/NeverDrop-SPaDe-Setup.exe"
     rel="noopener noreferrer">Download for Windows</a>
  <p style="margin-top:10px;font-size:13px">
    <a href="https://github.com/spadecorp/neverdrop/releases/latest"
       rel="noopener noreferrer">Release notes &amp; portable version</a>
  </p>
</div>
```

**Do not deploy an active download link yet.** The `spadecorp/neverdrop` repository and GitHub release need to be created first, and the expected asset filename must be verified. Until then, keep the existing Coming soon product card.

The stable asset names in the proposed GitHub Action let the same `releases/latest/download/...` URL continue working for later releases, provided each release uploads an asset with the exact same name.
