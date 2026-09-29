"""Build Figure 3 from audited full-pack records; no training or test selection.

Usage: python scripts/plot-blog-results.py /path/to/sap-rl-lab
"""
import gzip
import hashlib
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.ticker import PercentFormatter

ROOT = Path(sys.argv[1]).resolve()
OUT = Path(__file__).resolve().parents[1] / 'blog' / 'assets'
PUBLIC = ROOT / 'docs/evidence/fullpack-v1'
SEEDS = ('85101', '85201', '85301')
COLORS = ('#347c8d', '#b57b2a', '#8966a5')
source_hashes = {}


def read(path, expected=None):
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if expected is not None:
        assert digest == expected, f'Source changed: {path.name}'
    source_hashes[str(path.relative_to(ROOT))] = digest
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


manifest = read(PUBLIC / 'manifest.json')
hashes = {f['public_file']: f['public_file_sha256'] for f in manifest['files']}
selection = read(PUBLIC / 'segments--segment005--selection.json', hashes['segments--segment005--selection.json'])['selected']
evidence = read(ROOT / 'runs/fullpack-tier6-curves-final-v1/evidence.json')
models = []
for seed, label, color in zip(SEEDS, 'ABC', COLORS):
    points = []
    selected = None
    for point in evidence['curves'][seed]:
        # Recount the original evaluation, not pixels from an existing plot.
        path = Path(point['checkpoint']['path']).with_suffix('.json')
        record = read(path, evidence['input_sha256'][str(path)])
        learned = [v for k, v in record['evaluation']['families'].items() if k.startswith('validation_')]
        assert len(learned) == 2
        rows = [r for family in learned for r in family['episode_results']]
        assert len(rows) == 400
        score = sum(r['success'] for r in rows) / len(rows)
        assert abs(score - point['learned_success']) < 1e-10
        simple = {'steps': point['fullpack_steps'], 'success_rate': score}
        if points and points[-1]['steps'] == simple['steps']:
            assert points[-1] == simple  # duplicate segment-boundary reload
        else:
            points.append(simple)
        if point['checkpoint']['sha256'] == selection[seed]['checkpoint']['sha256']:
            selected = simple
    assert selected and abs(selected['success_rate'] - selection[seed]['score'][0]) < 1e-10
    model = {'model': label, 'seed': int(seed), 'color': color, 'validation': points, 'selected': selected}
    opponents = None
    for name, filename in [('test', f'segments--segment005--test-{seed}.json.gz'),
                           ('confirmation', f'confirmation171-v1--model-{seed}.json.gz')]:
        record = read(PUBLIC / filename, hashes[filename])
        assert record['checkpoint']['sha256'] == selection[seed]['checkpoint']['sha256']
        learned = {k:v for k,v in record['evaluation']['families'].items() if k.startswith('test_')}
        assert len(learned) == 2
        identities = {k:v['league_sha256'] for k,v in learned.items()}
        if opponents is not None:
            assert opponents == identities
        opponents = identities
        rows = [r for v in learned.values() for r in v['episode_results']]
        assert len(rows) == 1000
        model[name] = {'episodes': len(rows), 'successes': sum(r['success'] for r in rows)}
        model[name]['success_rate'] = model[name]['successes'] / len(rows)
    models.append(model)

assert sum(m['test']['successes'] for m in models) == 2468
assert sum(m['confirmation']['successes'] for m in models) == 2456
data = {'models': models, 'scope': '60 pets, Tier 1–6 shops, 40-round episode cap',
        'notes': ['Validation: 400 episodes per point; raw, unsmoothed; repeated boundary reloads deduplicated.',
                  'Zero steps is the transferred Tier-5 policy, not random initialization.',
                  'Test and confirmation: 1,000 episodes per model, same learned opponent pools, different episode seeds.',
                  'Points are estimates, not confidence bounds or human win rates.'],
        'source_sha256': source_hashes}
(OUT / 'results-evidence.json').write_text(json.dumps(data, indent=2) + '\n')

plt.rcParams.update({'font.family':'DejaVu Sans', 'font.size':13, 'axes.titlesize':17,
                     'axes.labelsize':13, 'xtick.labelsize':12, 'ytick.labelsize':12,
                     'text.color':'#263c46', 'axes.labelcolor':'#263c46',
                     'xtick.color':'#52636c', 'ytick.color':'#52636c', 'axes.edgecolor':'#c5cfd3',
                     'svg.fonttype':'path', 'svg.hashsalt':'sap-blog-results-v1'})


def draw(stacked=False):
    fig, (ax, right) = plt.subplots(2 if stacked else 1, 1 if stacked else 2,
                                    figsize=(5.0, 10.4) if stacked else (12.4, 5.7))
    fig.subplots_adjust(left=.19 if stacked else .085, right=.95 if stacked else .98,
                        top=.90 if stacked else .84, bottom=.13 if stacked else .22,
                        hspace=.70, wspace=.32)
    for axis in (ax, right):
        axis.spines[['top','right']].set_visible(False)
        axis.tick_params(length=0, pad=8)
        axis.set_axisbelow(True)

    ax.set_title('1. Learning progress', loc='left', pad=38, fontweight='bold', fontsize=15 if stacked else 17)
    for model in models:
        x = [p['steps']/1e6 for p in model['validation']]
        y = [100*p['success_rate'] for p in model['validation']]
        ax.plot(x, y, lw=1.8, marker='o', ms=3.2, color=model['color'], label=model['model'])
        p = model['selected']
        ax.scatter([p['steps']/1e6], [100*p['success_rate']], marker='*', s=180,
                   color=model['color'], edgecolors='white', linewidths=.8, zorder=5)
    ax.plot([], [], marker='*', color='#52636c', linestyle='none', ms=11, label='Selected')
    ax.legend(frameon=False, loc='lower left', bbox_to_anchor=(-.02,1.015), ncol=4,
              handlelength=1.1, columnspacing=.8, handletextpad=.4, fontsize=12)
    ax.set(xlim=(-.05,6.6), ylim=(0,100), xlabel='Full-pack PPO steps (millions)',
           ylabel='Validation ten-win success')
    ax.set_xticks([0,2,4,6])
    ax.yaxis.set_major_formatter(PercentFormatter(100, decimals=0))
    ax.grid(axis='y', alpha=.25)
    ax.axhline(80, color='#9aa8ae', lw=1.2, ls=(0,(3,3)), zorder=0)
    ax.text(.025,.815,'80% target', transform=ax.transAxes, color='#657780', fontsize=11)
    ax.text(0,-.26,'Starts from Tier-5 weights\nRaw validation; no smoothing' if stacked else 'Starts from Tier-5 weights · no smoothing', transform=ax.transAxes,
            fontsize=11, color='#657780')

    right.set_title('2. Held-out performance', loc='left', pad=38, fontweight='bold', fontsize=15 if stacked else 17)
    for i, model in enumerate(models):
        y = 2-i
        test, fresh = model['test']['success_rate']*100, model['confirmation']['success_rate']*100
        right.plot([test,fresh], [y+.15,y-.15], color=model['color'], alpha=.45, lw=1.5)
        right.scatter(test,y+.15,c=model['color'],s=52,zorder=3)
        right.scatter(fresh,y-.15,facecolors='white',edgecolors=model['color'],marker='D',s=48,lw=1.6,zorder=3)
        for rate, yy in [(test,y+.15),(fresh,y-.15)]:
            right.annotate(f'{rate:.1f}%', (rate, yy), xytext=(8,0), textcoords='offset points',
                           va='center', fontsize=12, color='#263c46')
    right.legend(handles=[Line2D([],[],marker='o',linestyle='none',color='#52636c',label='Test'),
                          Line2D([],[],marker='D',linestyle='none',color='#52636c',markerfacecolor='white',label='Fresh seeds')],
                 loc='lower left',bbox_to_anchor=(-.02,1.015),frameon=False,ncol=2,fontsize=12,
                 handlelength=1.1,columnspacing=1,handletextpad=.4)
    right.set(xlim=(0,105), ylim=(-.55,2.55), xlabel='Ten-win episode success')
    right.set_yticks([2,1,0], ['Model A','Model B','Model C'])
    right.set_xticks([0,25,50,75,100])
    right.xaxis.set_major_formatter(PercentFormatter(100, decimals=0))
    right.grid(axis='x', alpha=.20)
    right.axvline(80,color='#9aa8ae',ls=(0,(3,3)),lw=1.2,zorder=0)
    right.text(.03,.035,'80% target',transform=right.transAxes,color='#657780',fontsize=11)
    right.text(0,-.26,'Mean: 82.27% test\n81.87% fresh seeds' if stacked else 'Mean: 82.27% test · 81.87% fresh seeds',transform=right.transAxes,
               fontsize=11,color='#657780')
    stem = 'results-fullpack-mobile' if stacked else 'results-fullpack'
    for extension in ('svg','png'):
        fig.savefig(OUT / f'{stem}.{extension}', dpi=180, facecolor='white',
                    metadata={'Date':None} if extension=='svg' else {})
    plt.close(fig)


draw()
draw(stacked=True)
print(json.dumps({'validation_points': [len(m['validation']) for m in models],
                  'selected_steps': [m['selected']['steps'] for m in models],
                  'test': [m['test']['success_rate'] for m in models],
                  'confirmation': [m['confirmation']['success_rate'] for m in models]}, indent=2))
