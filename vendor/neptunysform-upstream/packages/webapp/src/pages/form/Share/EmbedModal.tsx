import { IconCode } from '@tabler/icons-react'
import { FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { buildPublicFormUrl, useParam } from '@/utils'
import { helper } from '@neptunysform-inc/utils'

import { Button, ColorPicker, Input, Modal, Select, Switch } from '@/components'
import { FORM_EMBED_OPTIONS } from '@/consts'
import { useAppStore, useFormStore, useModal, useWorkspaceStore } from '@/store'

const SIZE_OPTIONS = [
  {
    label: 'px',
    value: 'px',
    min: 100
  },
  {
    label: '%',
    value: '%',
    min: 1,
    max: 100
  }
]

const MODAL_SIZE_OPTIONS = [
  { value: 'small', label: 'form.share.embed.small' },
  { value: 'medium', label: 'form.share.embed.medium' },
  { value: 'large', label: 'form.share.embed.large' }
]

const MODAL_LAUNCH_OPTIONS = [
  { value: 'click', label: 'form.share.embed.click' },
  { value: 'load', label: 'form.share.embed.load' },
  { value: 'delay', label: 'form.share.embed.delay' },
  { value: 'exit', label: 'form.share.embed.exit' },
  { value: 'scroll', label: 'form.share.embed.scroll' }
]

const POPUP_POSITION_OPTIONS = [
  { value: 'bottom-left', label: 'form.share.embed.bottomLeft' },
  { value: 'bottom-right', label: 'form.share.embed.bottomRight' }
]

const FRAME_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>html,body{margin:0;min-height:100%;background:#f8fafc;}body{font-family:Inter,system-ui,sans-serif;color:#0f172a;}.shell{min-height:100vh;padding:40px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;}.preview{width:min(1180px,100%);display:grid;gap:24px;}.hf{background:rgba(15,23,42,0.05);border-radius:8px;}.hf-1{width:40%;height:28px;}.hf-2{width:100%;height:28px;}.embed-stage{min-height:620px;padding:32px;display:flex;align-items:center;justify-content:center;border-radius:24px;background:linear-gradient(180deg,#ffffff 0%,#f1f5f9 100%);box-shadow:inset 0 0 0 1px rgba(148,163,184,0.2);}.embed-stage>div{width:100%;}.neptunysform__embed-standard,.neptunysform__embed-fullpage{margin:0 auto;}.neptunysform__loading-container{display:none!important;}</style>
</head>
<body>
  <div class="shell">
    <div class="preview">
    <div class="hf hf-1"></div>
    <div class="hf hf-2"></div>

    <div class="embed-stage">
      {form}
    </div>
    </div>
  </div>
</body>
</html>
`

const FullpageEmbed: FC<ComponentProps> = ({ children }: ComponentProps) => {
  const { t } = useTranslation()
  const { embedConfig, updateEmbedConfig } = useFormStore()

  return (
    <>
      {children}

      <div className="flex items-center justify-between">
        <div className="text-sm/6">{t('form.share.embed.transparentBackground')}</div>
        <Switch
          value={embedConfig.transparentBackground}
          onChange={transparentBackground =>
            updateEmbedConfig({
              transparentBackground
            })
          }
        />
      </div>
    </>
  )
}

const RESIZE_OPTIONS = [
  {
    label: 'form.share.embed.auto',
    value: 'auto'
  },
  {
    label: 'form.share.embed.fixed',
    value: 'fixed'
  }
]

const StandardEmbed = () => {
  const { t } = useTranslation()
  const { embedConfig, updateEmbedConfig } = useFormStore()

  return (
    <FullpageEmbed>
      <div className="flex items-center justify-between">
        <div className="text-sm/6">{t('form.share.embed.width')}</div>
        <Input.TypeNumber
          className="max-w-40"
          options={SIZE_OPTIONS}
          value={{
            value: embedConfig.width,
            type: embedConfig.widthType
          }}
          onChange={value =>
            updateEmbedConfig({
              width: value.value,
              widthType: value.type
            })
          }
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div className="text-sm/6">{t('form.share.embed.height')}</div>
          <Select
            options={RESIZE_OPTIONS}
            value={embedConfig.autoResizeHeight ? 'auto' : 'fixed'}
            multiLanguage
            onChange={value =>
              updateEmbedConfig({
                autoResizeHeight: value === 'auto'
              })
            }
          />
        </div>

        {!embedConfig.autoResizeHeight && (
          <div className="mt-2 flex justify-end">
            <Input.TypeNumber
              className="max-w-40"
              options={SIZE_OPTIONS}
              value={{
                value: embedConfig.height,
                type: embedConfig.heightType
              }}
              onChange={value =>
                updateEmbedConfig({
                  height: value.value,
                  heightType: value.type
                })
              }
            />
          </div>
        )}
      </div>
    </FullpageEmbed>
  )
}

const ModalEmbed: FC<ComponentProps> = ({ children }) => {
  const { t } = useTranslation()
  const { embedType, embedConfig, updateEmbedConfig } = useFormStore()

  const launchChildren = useMemo(() => {
    switch (embedConfig.openTrigger) {
      case 'delay':
        return (
          <Input
            className="mt-2"
            trailing={t('form.share.embed.secondsDelay')}
            type="number"
            min={0}
            value={embedConfig.openDelay}
            onChange={openDelay => updateEmbedConfig({ openDelay })}
          />
        )

      case 'scroll':
        return (
          <Input
            className="mt-2"
            trailing={t('form.share.embed.pageScrolled')}
            type="number"
            min={0}
            max={100}
            value={embedConfig.openScrollPercent}
            onChange={openScrollPercent => updateEmbedConfig({ openScrollPercent })}
          />
        )

      default:
        return null
    }
  }, [
    embedConfig.openDelay,
    embedConfig.openScrollPercent,
    embedConfig.openTrigger,
    t,
    updateEmbedConfig
  ])

  return (
    <FullpageEmbed>
      {embedType === 'modal' && (
        <div className="space-y-1">
          <div className="text-sm/6">{t('form.share.embed.size')}</div>
          <Select
            className="w-full"
            options={MODAL_SIZE_OPTIONS}
            value={embedConfig.size}
            multiLanguage
            onChange={size => updateEmbedConfig({ size })}
          />
        </div>
      )}

      <div className="space-y-1">
        <div className="space-y-1">
          <div className="text-sm/6">{t('form.share.embed.launch')}</div>
          <Select
            className="w-full"
            options={MODAL_LAUNCH_OPTIONS}
            value={embedConfig.openTrigger}
            multiLanguage
            onChange={openTrigger => updateEmbedConfig({ openTrigger })}
          />
        </div>

        {launchChildren}
      </div>

      {children}

      <div className="flex items-center justify-between">
        <div className="text-sm/6">{t('form.share.embed.triggerBackground')}</div>
        <ColorPicker
          value={embedConfig.triggerBackground}
          contentProps={{
            side: 'right',
            align: 'center'
          }}
          onChange={triggerBackground => updateEmbedConfig({ triggerBackground })}
        />
      </div>

      {embedType === 'modal' && (
        <div className="space-y-1">
          <div className="text-sm/6">{t('form.share.embed.triggerText')}</div>
          <Input
            value={embedConfig.triggerText}
            maxLength={20}
            onChange={triggerText => updateEmbedConfig({ triggerText })}
          />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-sm/6">{t('form.share.embed.hideAfterSubmit')}</div>
          <Switch
            value={embedConfig.hideAfterSubmit}
            onChange={hideAfterSubmit => updateEmbedConfig({ hideAfterSubmit })}
          />
        </div>

        {helper.isTrue(embedConfig.hideAfterSubmit) && (
          <Input
            type="number"
            min={0}
            trailing={t('form.share.embed.secondsDelay')}
            value={embedConfig.autoClose}
            onChange={autoClose => updateEmbedConfig({ autoClose })}
          />
        )}
      </div>
    </FullpageEmbed>
  )
}

const PopupEmbed = () => {
  const { t } = useTranslation()
  const { embedConfig, updateEmbedConfig } = useFormStore()

  return (
    <ModalEmbed>
      <div className="space-y-1">
        <div className="text-sm/6">{t('form.share.embed.position')}</div>
        <Select
          className="w-full"
          options={POPUP_POSITION_OPTIONS}
          value={embedConfig.position}
          multiLanguage
          onChange={position => updateEmbedConfig({ position })}
        />
      </div>

      <div className="space-y-1">
        <div className="text-sm/6">{t('form.share.embed.width')}</div>
        <Input
          trailing={<span>px</span>}
          type="number"
          min={0}
          value={embedConfig.width}
          onChange={width => updateEmbedConfig({ width })}
        />
      </div>

      <div className="space-y-1">
        <div className="text-sm/6">{t('form.share.embed.height')}</div>
        <Input
          trailing={<span>px</span>}
          type="number"
          min={0}
          value={embedConfig.height}
          onChange={height => updateEmbedConfig({ height })}
        />
      </div>
    </ModalEmbed>
  )
}

const EmbedComponent = () => {
  const { t } = useTranslation()

  const { formId } = useParam()
  const { openModal, closeModal } = useAppStore()
  const { embedType, embedConfig, form, selectEmbedType } = useFormStore()
  const { sharingURLPrefix, workspace } = useWorkspaceStore()

  const sidebar = useMemo(() => {
    switch (embedType) {
      case 'modal':
        return <ModalEmbed />

      case 'popup':
        return <PopupEmbed />

      case 'fullpage':
        return <FullpageEmbed />

      default:
        return <StandardEmbed />
    }
  }, [embedType])

  const code = useMemo(() => {
    const attributes: string[] = Object.keys(embedConfig).reduce((prev, key) => {
      const name = 'data-neptunysform-' + key.replace(/[A-Z]/g, w => `-${w.toLowerCase()}`)

      return [...prev, `${name}="${embedConfig[key]}"`]
    }, [] as string[])
    const containerId = `neptunysform-embed-${formId}-${embedType}`

    const publicUrl = buildPublicFormUrl({
      sharingURLPrefix,
      formId,
      slug: form?.slug,
      isDomainRoot: form?.isDomainRoot,
      customDomain: workspace?.customDomain
    })

    if (embedType === 'standard') {
      return `<div
	id="${containerId}"
	data-neptunysform-id="${formId}"
	data-neptunysform-type="standard"
	data-neptunysform-custom-url="${publicUrl}"
	data-neptunysform-hiddenfield-neptunysform_meta_bridge="1"
	${attributes.join('\n\t')}
></div>
<script>
  (function () {
    var container = document.getElementById(${JSON.stringify(containerId)});

    if (!container) {
      return;
    }

    var hiddenFieldPrefix = 'data-neptunysform-hiddenfield-';
    var initializedPixels = {};
    var latestPayload = null;
    var isVisible = false;
    var quizTracked = false;
    var leadTracked = false;
    var leadFallbackTimeoutId = 0;

    function readSetting(name, fallbackValue) {
      var value = container.getAttribute(name);
      return value === null || value === '' ? fallbackValue : value;
    }

    function isTruthy(value) {
      return value === '1' || value === 'true';
    }

    function dispatchNeptunysformEvent(eventName, payload) {
      window.dispatchEvent(
        new CustomEvent('neptunysform:event', {
          detail: {
            eventName: eventName,
            payload: payload || {}
          }
        })
      );
    }

    function buildQueryParams() {
      var params = new URLSearchParams(window.location.search);

      container.getAttributeNames().forEach(function (name) {
        if (name.indexOf(hiddenFieldPrefix) !== 0) {
          return;
        }

        var key = name.slice(hiddenFieldPrefix.length);

        if (params.has(key)) {
          return;
        }

        var value = container.getAttribute(name);

        if (value !== null) {
          params.set(key, value);
        }
      });

      params.set('neptunysform_meta_bridge', '1');

      var transparentBackground = readSetting('data-neptunysform-transparent-background', '');
      if (transparentBackground) {
        params.set('transparentBackground', transparentBackground);
      }

      var hideAfterSubmit = readSetting('data-neptunysform-hide-after-submit', '');
      if (hideAfterSubmit) {
        params.set('hideAfterSubmit', hideAfterSubmit);
      }

      return params;
    }

    function appendQuery(url, params) {
      var query = params.toString();

      if (!query) {
        return url;
      }

      return url + (url.indexOf('?') === -1 ? '?' : '&') + query;
    }

    function ensureMetaPixel(payload) {
      if (typeof window.fbq !== 'function' || !payload || !payload.metaPixelEnabled) {
        return false;
      }

      var pixelId = typeof payload.metaPixelId === 'string' ? payload.metaPixelId.trim() : '';

      if (pixelId && !initializedPixels[pixelId]) {
        window.fbq('set', 'autoConfig', false, pixelId);
        window.fbq('init', pixelId);
        initializedPixels[pixelId] = true;
      }

      return true;
    }

    function maybeTrackQuizView() {
      if (!isVisible || quizTracked || !latestPayload || !ensureMetaPixel(latestPayload)) {
        return;
      }

      quizTracked = true;
      dispatchNeptunysformEvent('FORM_VISIBLE', latestPayload);
      window.fbq('trackCustom', 'Quizview', latestPayload);
    }

    function trackLead(payload) {
      if (leadTracked || !payload || !ensureMetaPixel(payload)) {
        return;
      }

      leadTracked = true;
      window.fbq('track', 'Lead', payload);
    }

    function scheduleLeadFallback(payload) {
      if (leadTracked || leadFallbackTimeoutId) {
        return;
      }

      leadFallbackTimeoutId = window.setTimeout(function () {
        leadFallbackTimeoutId = 0;
        trackLead(payload);
      }, 1000);
    }

    function cancelLeadFallback() {
      if (!leadFallbackTimeoutId) {
        return;
      }

      window.clearTimeout(leadFallbackTimeoutId);
      leadFallbackTimeoutId = 0;
    }

    function syncFrameHeight() {
      var widthType = readSetting('data-neptunysform-width-type', '%');
      var widthValue = readSetting('data-neptunysform-width', '100');
      var heightType = readSetting('data-neptunysform-height-type', 'px');
      var heightValue = readSetting('data-neptunysform-height', '500');
      var autoResizeHeight = isTruthy(readSetting('data-neptunysform-auto-resize-height', 'false'));

      container.style.width = widthValue + widthType;

      if (!autoResizeHeight) {
        container.style.height = heightValue + heightType;
        return;
      }

      var rect = container.getBoundingClientRect();
      var containerWidth = rect.width || container.clientWidth || window.innerWidth;
      var computedHeight =
        window.innerWidth <= 768
          ? window.innerHeight
          : Math.min(window.innerHeight, containerWidth * 0.6);

      container.style.height = Math.max(420, Math.round(computedHeight)) + 'px';
    }

    syncFrameHeight();

    var iframe = document.createElement('iframe');
    iframe.src = appendQuery(readSetting('data-neptunysform-custom-url', ''), buildQueryParams());
    iframe.title = 'NeptunysForm';
    iframe.allow = 'microphone; camera';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.background = 'transparent';

    container.replaceChildren(iframe);

    if (typeof window.IntersectionObserver === 'function') {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.35) {
              return;
            }

            isVisible = true;
            maybeTrackQuizView();
            observer.disconnect();
          });
        },
        {
          threshold: [0.35]
        }
      );

      observer.observe(container);
    } else {
      isVisible = true;
    }

    window.addEventListener('resize', syncFrameHeight);

    window.addEventListener('message', function (event) {
      if (event.source !== iframe.contentWindow) {
        return;
      }

      var data = event.data;

      if (!data || data.source !== 'NEPTUNYSFORM' || typeof data.eventName !== 'string') {
        return;
      }

      var payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
      latestPayload = payload;

      dispatchNeptunysformEvent(data.eventName, payload);
      maybeTrackQuizView();

      if (data.eventName === 'FORM_SUBMITTED') {
        scheduleLeadFallback(payload);
        return;
      }

      if (data.eventName === 'FORM_THANK_YOU_VISIBLE') {
        cancelLeadFallback();
        trackLead(payload);
      }
    });
  })();
</script>
`
    }

    return `<div
	id="${containerId}"
	data-neptunysform-id="${formId}"
	data-neptunysform-type="${embedType}"
	data-neptunysform-custom-url="${publicUrl}"
	data-neptunysform-hiddenfield-neptunysform_meta_bridge="1"
	${attributes.join('\n\t')}
>
  ${embedType === 'modal' ? `<button class="neptunysform__trigger-button" type="button" onclick="NeptunysForm.openModal('${formId}Modal')">${embedConfig.triggerText}</button>` : ''}
</div>
<script>
  (function () {
    var container = document.getElementById(${JSON.stringify(containerId)});

    if (!container) {
      return;
    }

    var urlParams = new URLSearchParams(window.location.search);
    urlParams.forEach(function (value, key) {
      var attrName = 'data-neptunysform-hiddenfield-' + key;

      if (!container.hasAttribute(attrName)) {
        container.setAttribute(attrName, value);
      }
    });

    var bridge = (window.__NEPTUNYSFORM_META_BRIDGE__ = window.__NEPTUNYSFORM_META_BRIDGE__ || {
      initializedPixels: {},
      installed: false
    });

    if (bridge.installed) {
      return;
    }

    bridge.installed = true;
    window.addEventListener('message', function (event) {
      var data = event.data;

      if (!data || data.source !== 'NEPTUNYSFORM' || typeof data.eventName !== 'string') {
        return;
      }

      var payload = data.payload && typeof data.payload === 'object' ? data.payload : {};

      window.dispatchEvent(
        new CustomEvent('neptunysform:event', {
          detail: {
            eventName: data.eventName,
            payload: payload
          }
        })
      );

      if (typeof window.fbq !== 'function' || !payload.metaPixelEnabled) {
        return;
      }

      var pixelId = typeof payload.metaPixelId === 'string' ? payload.metaPixelId.trim() : '';

      if (pixelId && !bridge.initializedPixels[pixelId]) {
        window.fbq('set', 'autoConfig', false, pixelId);
        window.fbq('init', pixelId);
        bridge.initializedPixels[pixelId] = true;
      }

      if (data.eventName === 'FORM_OPENED') {
        window.fbq('trackCustom', 'Quizview', payload);
      }

      if (data.eventName === 'FORM_SUBMITTED') {
        window.fbq('track', 'Lead', payload);
      }
    });
  })();
</script>
<script src="https://www.unpkg.com/@neptunysform-inc/embed@latest/dist/index.umd.js"></script>
`
  }, [embedConfig, embedType, form?.isDomainRoot, form?.slug, formId, sharingURLPrefix, workspace?.customDomain])

  const content = useMemo(() => FRAME_CONTENT.replace('{form}', code), [code])

  return (
    <div className="flex h-full">
      <div className="scrollbar border-accent-light h-full w-full border-r px-4 py-6 sm:w-80">
        <div className="flex items-center justify-between">
          <h2 className="text-base/6 font-semibold">{t('form.share.embed.title')}</h2>

          <Button.Link
            className="text-secondary hover:text-primary !p-0 hover:bg-transparent"
            size="sm"
            onClick={() => closeModal('EmbedModal')}
          >
            {t('components.close')}
          </Button.Link>
        </div>

        <div className="mt-4 space-y-2.5">
          <Select
            className="w-full"
            value={embedType}
            options={FORM_EMBED_OPTIONS as AnyMap[]}
            multiLanguage
            onChange={selectEmbedType}
          />
          <Button
            className="w-full"
            onClick={() => {
              openModal('CodeModal', { code })
            }}
          >
            <IconCode />
            <span>{t('form.share.embed.getCode')}</span>
          </Button>
        </div>

        <div className="mt-8">
          <h2 className="text-sm/6 font-semibold">{t('form.share.embed.settings')}</h2>
          <div className="mt-2 space-y-4">{sidebar}</div>
        </div>
      </div>

      <div className="bg-background h-full flex-1">
        <div className="hidden h-full w-full lg:block">
          <iframe className="h-full w-full border-0" srcDoc={content} />
        </div>
      </div>
    </div>
  )
}

function CodeModal() {
  const { t } = useTranslation()
  const { isOpen, payload, onOpenChange } = useModal('CodeModal')

  return (
    <>
      <Modal.Simple
        open={isOpen}
        title={t('form.share.embed.code.headline')}
        description={t('form.share.embed.code.subHeadline')}
        contentProps={{
          className: 'max-w-3xl'
        }}
        onOpenChange={onOpenChange}
      >
        <pre className="bg-primary text-foreground my-6 overflow-x-auto rounded p-4 text-sm">
          <code>{payload?.code}</code>
        </pre>

        <Button.Copy text={payload?.code} />
      </Modal.Simple>
    </>
  )
}

export default function EmbedModal() {
  const { isOpen, onOpenChange } = useModal('EmbedModal')

  return (
    <>
      <Modal
        open={isOpen}
        overlayProps={{
          className: 'bg-transparent'
        }}
        contentProps={{
          className:
            'p-0 w-screen max-w-screen max-h-screen overflow-hidden h-screen bg-foreground focus:outline-none focus-visible:outline-none'
        }}
        isCloseButtonShow={false}
        onOpenChange={onOpenChange}
      >
        <EmbedComponent />
      </Modal>

      <CodeModal />
    </>
  )
}
