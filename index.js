const { spawn, execSync } = require('child_process')
const ini = require('ini-alt')

module.exports = {

    commands: async () => {

        const str = await ( await execSync('vcgencmd commands') ).toString()
        const cmds = ini.decode(str)?.commands?.split(',').map( c => c.trim() )
        return cmds;
    },
    report: async () => {

        let out = {}

        const spacedWithEquals = (cmd, str) => { 
            const arr = str.replaceAll('\n', '').split(' ')
            if (arr.length < 2) return ( out[cmd] = arr[0].split('=')[1] )
            out[cmd] = {}
            arr.forEach( s => out[cmd][s.split('=')[0]] = s.split('=')[1] )
        }
        const spacedWithColon = (cmd, str) => { 
            const arr = str.replaceAll('\n', '').split(' ')
            if (arr.length < 2) return ( out[cmd] = arr[0].split(':')[1] )
            out[cmd] = {}
            arr.forEach( s => out[cmd][s.split(':')[0]] = s.split(':')[1] )
        }
        const nestedWithEquals = (cmd, str) => { 
            const key = cmd.split(' ')[0]
            if (!out[key]) out[key] = {}
            let v = str.split('=')[1].replaceAll('\n', '')
            if (v == 'enabled') v = true
            if (v == 'disabled') v = false
            out[key][str.split('=')[0]] = v
        }
        const nestedWithKey = (cmd, str) => { 
            const key = cmd.split(' ')[0]
            if (!out[key]) out[key] = {}
            out[key][cmd.split(' ')[1]] = str.split('=')[1].replaceAll('\n', '')
        }
        const nestedWithColon = (cmd, str) => { 
            if (!out[cmd]) out[cmd] = {}
            str.split('\n').filter( s => s != '').forEach( l => {
                out[cmd][l.split(':')[0]] = l.split(':')[1]?.trim() 
            } )
        }
        const splitNewline = (key, str) => out[key] = str.split('\n').map(s => s.trim() ).filter( s => s != '' )

        let methods = {
            'version': splitNewline,
            'get_camera': spacedWithEquals,
            'get_throttled': spacedWithEquals,
            'measure_temp': spacedWithEquals,
            'get_config str': (key, str) => {
                const k = key.split(' ')[0]
                out[k] = {}
                str.split('\n').forEach( s => out[k][s.split('=')[0]] = s.split('=')[1])
            }, 
            'get_lcd_info': (key, str) => out[key] = str.replaceAll('\n', ''), 
            'mem_oom': nestedWithColon, 
            'mem_reloc_stats': nestedWithColon, 
            'read_ring_osc': (key, str) => out[key] = str.replaceAll('\n', '').split('=')[1], 
            'hdmi_timings': (key, str) => out[key] = str.replaceAll('\n', '').split('=')[1], 
            'dispmanx_list': spacedWithColon, 
            'display_power': spacedWithEquals
        }
        const nested = [ 
            {
                cmd: 'measure_clock',
                args: ['arm','core','H264','isp','v3d','uart','pwm','emmc','pixel','vec','hdmi','dpi'],
                func: nestedWithEquals
            },
            {
                cmd: 'codec_enabled',
                args: ['AGIF','FLAC','H263','H264','MJPA','MJPB','MJPG','MPG2','MPG4','MVC0','PCM','THRA','VORB','VP6','VP8','WMV9','WVC1'],
                func: nestedWithEquals
            },
            {
                cmd: 'measure_volts',
                args: ['core','sdram_c','sdram_i','sdram_p'],
                func: nestedWithKey
            }
        ]
        nested.forEach( o => o.args.forEach( a => methods[`${o.cmd} ${a}`] = o.func ))
        const cmds = Object.keys( methods )
        let str = ''
        for (let i = 0; i < cmds.length; i++) {
            const cmd = cmds[i]
            const s = await ( await execSync(`vcgencmd ${cmd}`) ).toString()
            str += s + '\n~\n'
            methods[cmd]( cmd, s )

        }
        return out
    }

}


