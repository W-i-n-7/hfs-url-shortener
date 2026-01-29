exports.version = 1.101
exports.apiRequired = 11.6
exports.description = "Make shortened URLs with HFS"
exports.repo = "W-i-n-7/hfs-url-shortener"
exports.preview = ["https://raw.githubusercontent.com/W-i-n-7/hfs-url-shortener/refs/heads/main/imgs/settings.png"]

exports.config = {
    links: {
        type: 'array',
        label: 'Shortened links:',
        helperText: 'Multiple of the same link cannot exist at the same time. Destination can.',
        fields: {
            link: {
                type: 'string',
                label: 'Link',
                defaultValue: '/default-link',
                helperText: 'Must start with a /\nThis url will redirect the user to the destination url.'
            },
            destination: {
                type: 'string',
                label: 'Destination:',
                defaultValue: 'https://example.com',
                helperText: 'Where user gets redirected to.'
            }
        }
    },
    managementAPI: {
        type: 'boolean',
        label: 'Link management API'
    },
    text: {
        type: 'showHtml',
        html: '<span style="font-size: 12px; color: rgb(120, 120, 120)">Example usage:<br>GET /url-shortener/create-link?auth=password&link=/example&destination=http://example.com/<br>GET /url-shortener/delete-link?auth=password&link=/example<span>',
        showIf: values => values.managementAPI
    },
    managementUI: {
        type: 'boolean',
        label: 'Link management UI',
        defaultValue: true,
        helperText: 'Simple user interface to create or delete links at: /url-shortener',
        showIf: values => values.managementAPI
    },
    text2: {
        type: 'showHtml',
        html: '<button><a href="/url-shortener" target="_blank" style="text-decoration: none; color: #000;">Management UI</a></button>',
        showIf: values => values.managementUI && values.managementAPI
    },
    linkPrefix: {
        type: 'string',
        label: 'Link prefix',
        defaultValue: '/shrt',
        helperText: 'Must start with a /',
        sm: 4,
        showIf: values => values.managementAPI
    },
    linkSlashAllowed: {
        type: 'boolean',
        label: 'Allow folders in links (/)',
        sm: 4,
        showIf: values => values.managementAPI
    },
    linkEditAllowed: {
        type: 'boolean',
        label: 'Allow edit',
        helperText: 'When disabled link will need to be deleted first to edit',
        sm: 4,
        showIf: values => values.managementAPI
    },
    linkCreatePass: {
        type: 'string',
        label: 'Link creation password',
        helperText: 'Leave blank for none.',
        sm: 6,
        showIf: values => values.managementAPI
    },
    linkDeletePass: {
        type: 'string',
        label: 'Link deletion password',
        helperText: 'Leave blank for none.',
        sm: 6,
        showIf: values => values.managementAPI
    },
    
}

const fs = require('fs');
const path = require('path');

exports.init = async api => {
    exports.middleware = ctx => {
        if (ctx.path === '/url-shortener' && api.getConfig('managementUI') && api.getConfig('managementAPI'))
        {
            try {
                const data = fs.readFileSync(path.resolve(__dirname, 'plugin.html'), 'utf8');
                ctx.body = data
            } catch (err) {
                ctx.body = 'Error.'
                api.log(err);
            }
            
            return ctx.stop?.() || true
        }

        if (ctx.path === '/url-shortener/create-link' && api.getConfig('managementAPI'))
        {
            var passwd = api.getConfig('linkCreatePass')
            if (decodeURIComponent(ctx.query.auth) ===  passwd || passwd === undefined || passwd === '')
            {
                if (ctx.query.link && ctx.query.destination)
                {
                    if (ctx.query.link === '/')
                    {
                        ctx.status = 400
                        ctx.body = 'You are not allowed to redirect the root.'
                        return ctx.stop?.() || true
                    }

                    if (!ctx.query.link.startsWith('/'))
                    {
                        ctx.query.link = '/' + ctx.query.link
                    }
                    
                    if (!api.getConfig('linkSlashAllowed'))
                    {
                        if (ctx.query.link.substring(1).includes('/'))
                        {
                            ctx.status = 400
                            ctx.body = 'You are not allowed to use /.'
                            return ctx.stop?.() || true
                        }
                    }
                    
                    ctx.query.link = api.getConfig('linkPrefix') + ctx.query.link

                    // Check if link exists already
                    // If it exists already we delete so that it can be updated
                    var array = api.require('lodash').cloneDeep(api.getConfig('links'))
                    var confIndex = array.findIndex(item => item.link === ctx.query.link)
                    if (confIndex !== -1) // Exists
                    {
                        if (api.getConfig('linkEditAllowed'))
                        {
                            deleteLink(ctx.query.link)
                        }
                        else
                        {
                            ctx.status = 409
                            ctx.body = 'Link already exists.'
                            return ctx.stop?.() || true
                        }
                    }

                    var array = api.require('lodash').cloneDeep(api.getConfig('links'))
                    // var array = api.require('lodash').cloneDeep(api.getConfig('links')) || [];	

                    array.push({
                        link: ctx.query.link,
                        destination: ctx.query.destination
                    });
                    api.setConfig('links', array)

                    ctx.body = 'OK - ' + ctx.query.link
                    ctx.status = 200
                    return ctx.stop?.() || true
                }
                else
                {
                    ctx.body = 'Missing link or destination parameter.'
                    ctx.status = 400
                    return ctx.stop?.() || true
                }
            }
            else
            {
                ctx.body = 'Wrong password.'
                ctx.status = 403
                return ctx.stop?.() || true
            }
        }

        if (ctx.path === '/url-shortener/delete-link' && api.getConfig('managementAPI'))
        {
            const passwd = api.getConfig('linkDeletePass')
            if (decodeURIComponent(ctx.query.auth) ===  passwd || passwd === undefined)
            {
                if (ctx.query.link)
                {
                    if (!ctx.query.link.startsWith('/'))
                    {
                        ctx.query.link = '/' + ctx.query.link
                    }

                    ctx.query.link = api.getConfig('linkPrefix') + ctx.query.link

                    if (deleteLink(ctx.query.link))
                    {
                        ctx.body = 'OK'
                        ctx.status = 200
                    }
                    else
                    {
                        ctx.body = 'NotFound'
                        ctx.status = 404
                    }
                }
                else
                {
                    ctx.body = 'Missing link parameter.'
                    ctx.status = 400
                    return ctx.stop?.() || true
                }
            }
            else
            {
                ctx.body = 'Wrong password.'
                ctx.status = 403
                return ctx.stop?.() || true
            }
        }

        var confIndex = api.getConfig('links').findIndex(item => item.link === ctx.path)
        if (confIndex !== -1) {
            ctx.set({
                'etag': '',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            ctx.redirect(api.getConfig('links')[confIndex].destination)
            ctx.status = 302 // If you use 301 it will permanently cache, Use 302 instead.

            // Other possible implementation:
            // ctx.status = 302
            // ctx.body = '<!DOCTYPE html><html><head><title>Redirecting...</title><meta http-equiv="refresh" content="0; url = ' + dest + '"><style>body{background-color:#000}</style></head><body>' + dest + '</body></html>'

            return ctx.stop?.() || true
        }
    }
    
    function deleteLink(link)
    {
        var array = api.require('lodash').cloneDeep(api.getConfig('links'))
        var confIndex = array.findIndex(item => item.link === link)
        if (confIndex !== -1)
        {
            array.splice(confIndex, 1)
            api.setConfig('links', array)
    
            return true
        }
        else
        {
            return false
        }
    }
}
